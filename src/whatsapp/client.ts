import express, { Request, Response } from 'express';
import { env } from '../config/env';
import { LeadState, Lead, Message } from '../state/LeadState';
import { generateSdrResponse, transcribeAudio, generateFollowUp, generateThreeHourFollowUp, extractPdfText, analyzeDocument, generateFollowUpCadence, generateAnalyticsInsights } from '../ai/openai';
import { getDb, isDbConnected } from '../state/db';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export const whatsappRouter = express.Router();

const activeSessions = new Set<string>();
const activeSending = new Set<string>();
const pendingProcessing = new Map<string, boolean>();
const followUpTimers = new Map<string, NodeJS.Timeout>();

// Tracker de mensagens enviadas pela IA para detecção de intervenção humana nas webhooks
class BotMessageTracker {
  private sentMessages = new Set<string>();

  private getTrackKey(phone: string, text: string): string {
    const cleanText = text
      .replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '') // remove emojis
      .replace(/\s+/g, '') // remove todos os espaços
      .toLowerCase();
    const cleanPhone = phone.replace(/\D/g, '');
    return `${cleanPhone}_${cleanText}`;
  }

  public track(phone: string, text: string) {
    const key = this.getTrackKey(phone, text);
    this.sentMessages.add(key);
    // Remove após 30 segundos
    setTimeout(() => {
      this.sentMessages.delete(key);
    }, 30000);
  }

  public hasAndConsume(phone: string, text: string): boolean {
    const key = this.getTrackKey(phone, text);
    if (this.sentMessages.has(key)) {
      this.sentMessages.delete(key);
      return true;
    }
    return false;
  }
}

export const botTracker = new BotMessageTracker();
export const botSentWamids = new Set<string>();

// Rota de Login para o CRM Dashboard
whatsappRouter.post('/api/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  const isValid = 
    (username === '@huddy' && password === 'Prime2026.') ||
    (username === '@perelli' && password === 'Perelli2026.') ||
    (username === '@admin' && password === 'PerelliAdmin.');

  if (isValid) {
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    activeSessions.add(token);
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Usuário ou senha incorretos' });
  }
});

// Rota de Verificação de Token
whatsappRouter.post('/api/verify', (req: Request, res: Response) => {
  const { token } = req.body;
  if (token && activeSessions.has(token)) {
    res.json({ valid: true });
  } else {
    res.status(401).json({ valid: false });
  }
});

// Lista todos os leads no CRM
whatsappRouter.get('/api/leads', async (req: Request, res: Response) => {
  const channelPhoneId = req.query.channelPhoneId as string;
  const source = req.query.source as string;
  try {
    const leads = await LeadState.getAllLeads(channelPhoneId, source);
    res.json(leads);
  } catch (error) {
    console.error('Erro ao buscar leads:', error);
    res.status(500).json({ error: 'Erro ao buscar dados do CRM' });
  }
});

// Lista canais de WhatsApp
whatsappRouter.get('/api/channels', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (db && isDbConnected) {
      const result = await db.query('SELECT * FROM whatsapp_channels ORDER BY created_at DESC');
      res.json(result.rows);
    } else {
      res.json([
        { phone_number_id: env.META_PHONE_ID || 'default', display_phone_number: 'Padrão', name: 'Canal Principal' }
      ]);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cria ou edita um canal de WhatsApp
whatsappRouter.post('/api/channels', async (req: Request, res: Response) => {
  const { phone_number_id, display_phone_number, access_token, name } = req.body;
  if (!phone_number_id || !display_phone_number || !name) {
    return res.status(400).json({ error: 'phone_number_id, display_phone_number, e name são obrigatórios.' });
  }
  try {
    const db = await getDb();
    if (db && isDbConnected) {
      await db.query(
        `INSERT INTO whatsapp_channels (phone_number_id, display_phone_number, access_token, name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT(phone_number_id) DO UPDATE SET
         display_phone_number = excluded.display_phone_number,
         access_token = excluded.access_token,
         name = excluded.name`,
        [phone_number_id, display_phone_number, access_token || null, name]
      );
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Banco de dados não conectado para salvar canal dinâmico.' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Busca o histórico de mensagens de um lead específico
whatsappRouter.get('/api/leads/:phone/messages', async (req: Request, res: Response) => {
  const phone = req.params.phone as string;
  const channelPhoneId = req.query.channelPhoneId as string || 'default';
  try {
    const lead = await LeadState.getLead(phone, channelPhoneId);
    res.json(lead.history.map(msg => ({
      sender: msg.role === 'user' ? 'user' : msg.content.startsWith('[Mídia manual') || msg.content.startsWith('[Resposta manual') ? 'agent' : 'bot',
      text: msg.content,
      media: msg.media
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Exclui um lead (limpa a conversa e a memória do SDR)
whatsappRouter.delete('/api/leads/:phone', async (req: Request, res: Response) => {
  const phone = req.params.phone as string;
  const channelPhoneId = req.query.channelPhoneId as string || 'default';
  try {
    // Limpa timers e estados ativos em memória
    clearFollowUpTimer(phone, channelPhoneId);
    
    const delayKey = `${phone}_${channelPhoneId}`;
    activeDelays.delete(delayKey);
    activeSending.delete(delayKey);
    pendingProcessing.delete(delayKey);

    await LeadState.deleteLead(phone, channelPhoneId);
    console.log(`🗑️ Lead ${phone} (canal: ${channelPhoneId}) foi excluído com sucesso do banco e memória.`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao excluir lead:', error);
    res.status(500).json({ error: error.message || 'Erro ao excluir lead' });
  }
});

// Cadastra ou reativa um Lead Ativo do CRM
whatsappRouter.post('/api/leads', async (req: Request, res: Response) => {
  const { phone, name, channelPhoneId, initialMessage, useTemplate, templateName } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Telefone é obrigatório' });
  }

  const activeChannel = channelPhoneId || env.META_PHONE_ID || 'default';

  try {
    let lead = await LeadState.getLead(phone, activeChannel);
    lead.name = name || 'Lead';
    lead.requires_intervention = false; // Reactivate AI SDR for this lead if it was stopped!
    await LeadState.saveLead(lead);

    let messageSent = initialMessage;

    if (useTemplate) {
      const activeTemplate = templateName || 'boas_vindas_perelli';
      const firstName = name ? name.split(' ')[0] : 'Lead';
      
      await sendTemplateMessage(activeChannel, phone, activeTemplate, [firstName]);
      messageSent = `Olá ${firstName}! Sou o Perelli, consultor virtual da Perelli Corretora. Tudo bem?\n\nMe conta: você quer cotar um plano de saúde individual, familiar ou seria empresarial/CNPJ?`;
    } else {
      if (!initialMessage) {
        return res.status(400).json({ error: 'Mensagem inicial é obrigatória para envio de texto livre' });
      }
      await sendMessage(activeChannel, phone, initialMessage);
    }

    await LeadState.addMessage(phone, activeChannel, 'assistant', messageSent);
    resetFollowUpTimer(phone, activeChannel);
    res.json({ success: true, lead });
  } catch (error: any) {
    console.error('Erro ao cadastrar lead ativo:', error);
    res.status(500).json({ error: error.message || 'Erro ao cadastrar novo lead' });
  }
});

// Envia mensagem manual do CRM Dashboard para o Lead no WhatsApp (Intervenção Humana)
whatsappRouter.post('/api/leads/:phone/manual-message', async (req: Request, res: Response) => {
  const phone = req.params.phone as string;
  const { text, channelPhoneId } = req.body;

  if (!phone || !text) {
    return res.status(400).json({ error: 'Telefone e texto são obrigatórios' });
  }

  const activeChannel = channelPhoneId || env.META_PHONE_ID || 'default';

  try {
    clearFollowUpTimer(phone, activeChannel);
    const chunks = splitMessage(text);
    for (const chunk of chunks) {
      await sendMessage(activeChannel, phone, chunk);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    const lead = await LeadState.getLead(phone, activeChannel);
    lead.unread = false;
    lead.follow_up_level = 0; // Reset follow-up cadence on manual intervention
    lead.last_follow_up_at = null;
    lead.requires_intervention = true; // Mark that salesperson took control, stopping AI responses!
    await LeadState.saveLead(lead);
    await LeadState.addMessage(phone, activeChannel, 'assistant', `[Resposta manual]: ${text}`);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao enviar mensagem manual:', error);
    res.status(500).json({ error: error.message || 'Erro ao enviar mensagem' });
  }
});

// Atualiza o estágio do lead manualmente via Drag & Drop no CRM
whatsappRouter.post('/api/leads/:phone/stage', async (req: Request, res: Response) => {
  const phone = req.params.phone as string;
  const { stage, channelPhoneId } = req.body;

  if (!phone || !stage) {
    return res.status(400).json({ error: 'Telefone e estágio são obrigatórios' });
  }

  const activeChannel = channelPhoneId || 'default';

  try {
    await LeadState.updateStage(phone, activeChannel, stage as Lead['stage']);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao atualizar estágio:', error);
    res.status(500).json({ error: error.message });
  }
});

// Marcar lead como lido
whatsappRouter.post('/api/leads/:phone/read', async (req: Request, res: Response) => {
  const phone = req.params.phone as string;
  const { channelPhoneId } = req.body;
  const activeChannel = channelPhoneId || 'default';

  try {
    const lead = await LeadState.getLead(phone, activeChannel);
    lead.unread = false;
    await LeadState.saveLead(lead);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao marcar como lido' });
  }
});

// Rota de Simulação Local (POST /api/simulate)
whatsappRouter.post('/api/simulate', async (req: Request, res: Response) => {
  const { phone, name, text, isAudio, channelPhoneId } = req.body;

  if (!phone || !text) {
    return res.status(400).json({ error: 'Telefone e texto são obrigatórios' });
  }

  const messageText = isAudio ? `[Áudio Transcrito: "${text}"]` : text;
  const contactName = name || 'Cliente Simulado';
  const activeChannel = channelPhoneId || 'default';

  console.log(`[SIMULATOR INCOMING] Channel: ${activeChannel}, Phone: ${phone}, Msg: "${messageText}"`);

  try {
    let lead = await LeadState.getLead(phone, activeChannel);
    if (!lead.name || lead.name === 'Lead') {
      lead.name = contactName;
      await LeadState.saveLead(lead);
    }

    let userText = messageText;
    let simulatedDocAnalysis = null;

    if (text.startsWith('[Documento Simulado:') || text.startsWith('[Imagem Simulada:')) {
      const textLower = text.toLowerCase();
      const docType = textLower.includes('rg') 
        ? 'rg' 
        : textLower.includes('cnh') 
          ? 'cnh' 
          : textLower.includes('comprovante') 
            ? 'comprovante_residencia' 
            : 'outro';
      const isInvalid = textLower.includes('invalido') || textLower.includes('inválido') || textLower.includes('outro');

      simulatedDocAnalysis = {
        detectedType: docType,
        isReadable: !isInvalid,
        isDocument: !isInvalid && docType !== 'outro',
        feedback: isInvalid 
          ? 'Arquivo ilegível ou inválido. Por favor, envie uma foto nítida e sem reflexos.' 
          : `${docType.toUpperCase()} recebido e validado com sucesso.`
      };

      userText = `[Imagem enviada - Tipo: ${simulatedDocAnalysis.detectedType}, Legível: ${simulatedDocAnalysis.isReadable}, É Documento: ${simulatedDocAnalysis.isDocument}, Feedback: ${simulatedDocAnalysis.feedback}]`;
    }

    if (simulatedDocAnalysis) {
      let docStatus = { rg_cnh: null as any, residence: null as any };
      if (lead.document_status) {
        try {
          docStatus = JSON.parse(lead.document_status);
        } catch (_) {}
      }

      if (simulatedDocAnalysis.isDocument && simulatedDocAnalysis.isReadable) {
        if (simulatedDocAnalysis.detectedType === 'rg' || simulatedDocAnalysis.detectedType === 'cnh') {
          docStatus.rg_cnh = { type: simulatedDocAnalysis.detectedType, valid: true, feedback: simulatedDocAnalysis.feedback };
        } else if (simulatedDocAnalysis.detectedType === 'comprovante_residencia') {
          docStatus.residence = { type: 'comprovante_residencia', valid: true, feedback: simulatedDocAnalysis.feedback };
        }
      } else {
        if (simulatedDocAnalysis.detectedType === 'rg' || simulatedDocAnalysis.detectedType === 'cnh') {
          docStatus.rg_cnh = { type: simulatedDocAnalysis.detectedType, valid: false, feedback: simulatedDocAnalysis.feedback };
        } else if (simulatedDocAnalysis.detectedType === 'comprovante_residencia') {
          docStatus.residence = { type: 'comprovante_residencia', valid: false, feedback: simulatedDocAnalysis.feedback };
        }
      }
      lead.document_status = JSON.stringify(docStatus);
      await LeadState.saveLead(lead);
    }

    await LeadState.addMessage(phone, activeChannel, 'user', userText);

    const delayKey = `${phone}_${activeChannel}`;
    if (activeDelays.has(delayKey)) {
      clearTimeout(activeDelays.get(delayKey));
      activeDelays.delete(delayKey);
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    // Resposta rápida de 1.5s na simulação local
    const timeoutId = setTimeout(async () => {
      activeDelays.delete(delayKey);
      try {
        const updatedLead = await LeadState.getLead(phone, activeChannel);
        
        // Se o corretor humano interveio, cancela a resposta da IA
        if (updatedLead.requires_intervention) {
          console.log(`[AI SDR STOPPED - SIMULATOR] O corretor interveio para o lead ${phone}. AI não responderá.`);
          return;
        }

        const sdrResult = await generateSdrResponse(updatedLead, baseUrl);
        
        if (sdrResult.stage !== updatedLead.stage) {
          await LeadState.updateStage(phone, activeChannel, sdrResult.stage);
          console.log(`🔄 Lead ${updatedLead.name} avançou para fase: ${sdrResult.stage}`);
        }

        // Salva a resposta no BD
        await LeadState.addMessage(phone, activeChannel, 'assistant', sdrResult.response, sdrResult.media);
        console.log(`[SIMULATOR OUTGOING] Perelli responde: "${sdrResult.response.replace(/\n/g, '\\n')}"`);
        
        if (sdrResult.media) {
          console.log(`[SIMULATOR OUTGOING] Mídia enviada: [${sdrResult.media.type}] URL: ${sdrResult.media.url}`);
        }
      } catch (err) {
        console.error('Erro ao responder simulador:', err);
      }
    }, 1500);

    activeDelays.set(delayKey, timeoutId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Erro na simulação local:', error);
    res.status(500).json({ error: error.message });
  }
});

// Desduplicação de webhooks da Meta
const processedMessageIds = new Set<string>();

// Delays de digitação por telefone (debouncing)
const activeDelays = new Map<string, NodeJS.Timeout>();

function cleanHtml(html: string): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function getTypingDelay(text: string): number {
  const charsPerSecond = 12;
  const delay = (text.length / charsPerSecond) * 1000;
  return Math.max(2500, Math.min(delay, 9000));
}

export async function fetchUrlContent(url: string): Promise<string> {
  try {
    let targetUrl = url;
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return `[Erro ao acessar o link: Código ${res.status}]`;
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/json')) {
      return `[Link contém tipo de arquivo não suportado: ${contentType}]`;
    }

    const bodyText = await res.text();
    const cleanedText = cleanHtml(bodyText);

    if (cleanedText.length > 2000) {
      return cleanedText.substring(0, 2000) + '... [Conteúdo truncado]';
    }

    return cleanedText || '[Página sem conteúdo de texto legível]';
  } catch (error: any) {
    console.error(`Erro ao acessar URL ${url}:`, error);
    if (error.name === 'AbortError') {
      return '[Erro ao acessar o link: Tempo limite de conexão esgotado]';
    }
    return `[Erro ao acessar o link: ${error.message || error}]`;
  }
}

export function splitMessage(text: string): string[] {
  // 1. Dividir por quebras de linha duplas para obter os blocos naturais (parágrafos)
  const paragraphs = text.split(/\n\s*\n+/);
  const finalChunks: string[] = [];

  for (const paragraph of paragraphs) {
    const trimmedPara = paragraph.trim();
    if (!trimmedPara) continue;

    // 2. Se o parágrafo tiver até 5 linhas, adiciona ele inteiro
    const lines = trimmedPara.split('\n');
    if (lines.length <= 5) {
      finalChunks.push(trimmedPara);
    } else {
      // 3. Se tiver mais de 5 linhas, divide em blocos de no máximo 5 linhas cada
      let currentSubChunk: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        currentSubChunk.push(lines[i]);
        if (currentSubChunk.length === 5 || i === lines.length - 1) {
          finalChunks.push(currentSubChunk.join('\n').trim());
          currentSubChunk = [];
        }
      }
    }
  }

  return finalChunks;
}

// GET /webhook - Verificação de webhook pela Meta
whatsappRouter.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN) {
      console.log('✅ Webhook verificado pela Meta!');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// POST /webhook - Recepção de mensagens enviadas por leads
whatsappRouter.post('/webhook', async (req: Request, res: Response) => {
  const body = req.body;
  console.log('📬 [WEBHOOK INCOMING] Payload recebido:', JSON.stringify(body, null, 2));

  // 1. Se for o webhook oficial da Meta
  if (body.object === 'whatsapp_business_account') {
    try {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const metadata = value?.metadata;
      
      // Recupera o Phone Number ID destinatário para multi-número
      const phone_number_id = metadata?.phone_number_id; 
      const messages = value?.messages;
      const statuses = value?.statuses;

      if (!res.headersSent) {
        res.sendStatus(200);
      }

      // Se for atualização de status de envio de mensagem (Meta Coexistência)
      if (statuses && Array.isArray(statuses) && phone_number_id) {
        for (const statusObj of statuses) {
          const statusVal = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
          const phone = statusObj.recipient_id;
          const wamid = statusObj.id;
          const activeChannel = phone_number_id;

          if (statusVal === 'sent') {
            // Verifica se essa mensagem foi enviada pelo nosso bot
            const isBot = botSentWamids.has(wamid);
            if (!isBot) {
              console.log(`[HUMAN INTERVENTION DETECTED - META STATUS] Detectada mensagem manual enviada por outro sistema para ${phone} (wamid: ${wamid}). Parando a IA.`);
              try {
                const lead = await LeadState.getLead(phone, activeChannel);
                lead.requires_intervention = true;
                lead.follow_up_level = 0;
                lead.last_follow_up_at = null;
                await LeadState.saveLead(lead);
                await LeadState.addMessage(phone, activeChannel, 'assistant', `[Intervenção Humana Externa]`);
              } catch (err) {
                console.error('Erro ao marcar requires_intervention via status da Meta:', err);
              }
            } else {
              // Remove do cache de enviados pelo bot
              botSentWamids.delete(wamid);
            }
          }
        }
        return;
      }

      if (messages && messages[0] && phone_number_id) {
        const message = messages[0];
        
        if (message.type !== 'text' && message.type !== 'audio' && message.type !== 'document' && message.type !== 'image') return;

        if (message.type === 'document' && message.document?.mime_type !== 'application/pdf') {
          console.log(`⚠️ Documento de tipo não suportado ignorado: ${message.document?.mime_type}`);
          return;
        }

        const messageId = message.id;
        
        if (processedMessageIds.has(messageId)) {
          console.log(`⚠️ [WEBHOOK] Ignorando mensagem duplicada (ID: ${messageId})`);
          return;
        }
        
        processedMessageIds.add(messageId);
        
        if (processedMessageIds.size > 500) {
          const firstAdded = Array.from(processedMessageIds)[0];
          processedMessageIds.delete(firstAdded);
        }

        const phone = message.from; 
        const contactName = value?.contacts?.[0]?.profile?.name || 'Lead';
        const activeChannel = phone_number_id;
        let userText = '';

        // Carrega a configuração do canal para baixar a mídia
        const channelConfig = await getChannelConfig(activeChannel);

        if (message.type === 'text') {
          userText = message.text.body;
          console.log(`\n📩 [CANAL: ${channelConfig.name}] Mensagem de ${contactName} (${phone}): ${userText}`);
        } else if (message.type === 'audio') {
          const audioId = message.audio?.id;
          const mimeType = message.audio?.mime_type || 'audio/ogg';
          console.log(`\n📩 [CANAL: ${channelConfig.name}] Áudio de ${contactName} (${phone}) - ID: ${audioId}. Transcrevendo...`);
          
          try {
            const mediaUrlRes = await fetch(`https://graph.facebook.com/v20.0/${audioId}`, {
              headers: { 'Authorization': `Bearer ${channelConfig.access_token}` }
            });
            if (!mediaUrlRes.ok) {
              throw new Error(`Falha ao buscar URL da mídia: ${mediaUrlRes.statusText}`);
            }
            const mediaUrlData = await mediaUrlRes.json() as { url: string };
            
            const audioDataRes = await fetch(mediaUrlData.url, {
              headers: { 'Authorization': `Bearer ${channelConfig.access_token}` }
            });
            if (!audioDataRes.ok) {
              throw new Error(`Falha ao baixar áudio: ${audioDataRes.statusText}`);
            }
            const audioArrayBuffer = await audioDataRes.arrayBuffer();
            const audioBuffer = Buffer.from(audioArrayBuffer);
            
            userText = await transcribeAudio(audioBuffer, mimeType);
            console.log(`📝 Áudio transcrevido de ${contactName} (${phone}): "${userText}"`);
          } catch (audioError) {
            console.error('❌ Erro ao transcrever áudio:', audioError);
            await sendMessage(activeChannel, phone, 'Desculpe, não consegui ouvir o seu áudio... Poderia me mandar em texto?');
            return;
          }
        } else if (message.type === 'image') {
          const imageId = message.image?.id;
          const mimeType = message.image?.mime_type || 'image/jpeg';
          console.log(`\n📩 [CANAL: ${channelConfig.name}] Imagem de ${contactName} (${phone}) - ID: ${imageId}. Analisando documento...`);
          
          try {
            const mediaUrlRes = await fetch(`https://graph.facebook.com/v20.0/${imageId}`, {
              headers: { 'Authorization': `Bearer ${channelConfig.access_token}` }
            });
            if (!mediaUrlRes.ok) {
              throw new Error(`Falha ao buscar URL da imagem: ${mediaUrlRes.statusText}`);
            }
            const mediaUrlData = await mediaUrlRes.json() as { url: string };
            
            const imageDataRes = await fetch(mediaUrlData.url, {
              headers: { 'Authorization': `Bearer ${channelConfig.access_token}` }
            });
            if (!imageDataRes.ok) {
              throw new Error(`Falha ao baixar imagem: ${imageDataRes.statusText}`);
            }
            const imageArrayBuffer = await imageDataRes.arrayBuffer();
            const imageBuffer = Buffer.from(imageArrayBuffer);
            
            const analysis = await analyzeDocument(imageBuffer, mimeType);
            userText = `[Imagem enviada - Tipo: ${analysis.detectedType}, Legível: ${analysis.isReadable}, É Documento: ${analysis.isDocument}, Feedback: ${analysis.feedback}]`;
            console.log(`📝 Análise da imagem de ${contactName} (${phone}): "${userText}"`);

            await updateLeadDocStatus(phone, activeChannel, analysis);
          } catch (imgError) {
            console.error('❌ Erro ao processar/analisar imagem:', imgError);
            await sendMessage(activeChannel, phone, 'Desculpe, não consegui abrir a sua imagem... Poderia me mandar novamente?');
            return;
          }
        } else if (message.type === 'document') {
          const documentId = message.document?.id;
          const filename = message.document?.filename || 'documento.pdf';
          console.log(`\n📩 [CANAL: ${channelConfig.name}] PDF de ${contactName} (${phone}) - ID: ${documentId}. Analisando PDF...`);
          
          try {
            const mediaUrlRes = await fetch(`https://graph.facebook.com/v20.0/${documentId}`, {
              headers: { 'Authorization': `Bearer ${channelConfig.access_token}` }
            });
            if (!mediaUrlRes.ok) {
              throw new Error(`Falha ao buscar URL do PDF: ${mediaUrlRes.statusText}`);
            }
            const mediaUrlData = await mediaUrlRes.json() as { url: string };
            
            const pdfDataRes = await fetch(mediaUrlData.url, {
              headers: { 'Authorization': `Bearer ${channelConfig.access_token}` }
            });
            if (!pdfDataRes.ok) {
              throw new Error(`Falha ao baixar PDF: ${pdfDataRes.statusText}`);
            }
            const pdfArrayBuffer = await pdfDataRes.arrayBuffer();
            const pdfBuffer = Buffer.from(pdfArrayBuffer);
            
            const analysis = await analyzeDocument(pdfBuffer, 'application/pdf');
            userText = `[Documento PDF enviado - Tipo: ${analysis.detectedType}, Legível: ${analysis.isReadable}, É Documento: ${analysis.isDocument}, Feedback: ${analysis.feedback}]`;
            console.log(`📝 Análise do PDF de ${contactName} (${phone}): "${userText}"`);

            await updateLeadDocStatus(phone, activeChannel, analysis);
          } catch (pdfError) {
            console.error('❌ Erro ao processar PDF:', pdfError);
            await sendMessage(activeChannel, phone, 'Desculpe, não consegui ler o arquivo PDF enviado... Poderia verificar se o arquivo está correto?');
            return;
          }
        }

        // Processa links na mensagem do usuário
        if (message.type === 'text' || message.type === 'audio') {
          const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(?:com|net|org|co|app|io|xyz|info|gov|edu|online|site)(?:\/[^\s]*)?)/gi;
          const matches = userText.match(urlRegex);
          if (matches && matches.length > 0) {
            const linksToProcess = matches.slice(0, 2);
            let linksInfo = '';
            for (const link of linksToProcess) {
              const pageContent = await fetchUrlContent(link);
              linksInfo += `\n\n[Conteúdo extraído do link (${link})]:\n${pageContent}`;
            }
            userText += linksInfo;
          }
        }

        // Pega ou cria o Lead escopado por canal
        let lead = await LeadState.getLead(phone, activeChannel);
        if (!lead.name || lead.name === 'Lead') {
          lead.name = contactName;
          await LeadState.saveLead(lead);
        }

        // Salva a mensagem no histórico
        await LeadState.addMessage(phone, activeChannel, 'user', userText);

        // Cancelar qualquer resposta pendente para este usuário (debouncing)
        const delayKey = `${phone}_${activeChannel}`;
        if (activeDelays.has(delayKey)) {
          clearTimeout(activeDelays.get(delayKey));
          activeDelays.delete(delayKey);
        }

        // Calcula o delay de resposta consultiva (debouncing e humanização)
        const charCount = userText.length;
        const baseDelay = 5000;
        const perCharDelay = Math.min(charCount * 40, 10000);
        const randomDelay = Math.floor(Math.random() * 4000) + 2000;
        const totalDelay = baseDelay + perCharDelay + randomDelay;

        const baseUrl = `${req.protocol}://${req.get('host')}`;

        const timeoutId = setTimeout(async () => {
          activeDelays.delete(delayKey);
          try {
            // Recarrega o lead atualizado
            const updatedLead = await LeadState.getLead(phone, activeChannel);

            // Se o corretor humano interveio, cancela a resposta da IA
            if (updatedLead.requires_intervention) {
              console.log(`[AI SDR STOPPED] O corretor interveio para o lead ${phone}. AI não responderá.`);
              return;
            }

            // Gera a resposta consultiva usando o Gemini
            const sdrResult = await generateSdrResponse(updatedLead, baseUrl);
            if (sdrResult.stage !== updatedLead.stage) {
              await LeadState.updateStage(phone, activeChannel, sdrResult.stage);
              console.log(`🔄 Lead ${updatedLead.name} avançou para fase: ${sdrResult.stage}`);
            }

            // Salva a resposta no histórico (incluindo mídias sugeridas se houver)
            await LeadState.addMessage(phone, activeChannel, 'assistant', sdrResult.response, sdrResult.media);

            // Envio por áudio de voz da ElevenLabs (se o Gemini decidir ou se o cliente mandou áudio)
            let audioSentSuccessfully = false;
            const shouldSendAudio = (sdrResult.send_audio === true || message.type === 'audio') && env.ELEVENLABS_API_KEY;
            
            if (shouldSendAudio) {
              console.log(`🎙️ [TTS ELEVENLABS - META] Gerando áudio de voz para ${phone}...`);
              const voiceBuffer = await generateSpeech(sdrResult.response);
              if (voiceBuffer) {
                try {
                  const delay = getTypingDelay(sdrResult.response);
                  await new Promise(resolve => setTimeout(resolve, delay));
                  
                  const mediaId = await uploadMediaToMeta(activeChannel, voiceBuffer, 'audio/ogg', `voice_${Date.now()}.ogg`);
                  await sendMediaMessage(activeChannel, phone, 'audio', { id: mediaId });
                  await LeadState.addMessage(phone, activeChannel, 'assistant', `[Resposta enviada por áudio/voz]`);
                  audioSentSuccessfully = true;
                  console.log(`🎙️ [TTS ELEVENLABS - META] Áudio enviado com sucesso para ${phone}`);
                } catch (audioErr) {
                  console.error(`❌ [TTS FALLBACK - META] Erro ao enviar áudio via Meta:`, audioErr);
                }
              }
            }

            // Fallback: Envia mensagem normal de texto se a IA não pediu áudio ou se a geração falhou
            if (!audioSentSuccessfully) {
              // Divide a resposta em mensagens consecutivas
              const chunks = splitMessage(sdrResult.response);
              console.log(`📤 Enviando resposta dividida em ${chunks.length} mensagens para ${phone}...`);

              for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const delay = getTypingDelay(chunk);
                await new Promise(resolve => setTimeout(resolve, delay));
                await sendMessage(activeChannel, phone, chunk);
              }
            }

            // Se a IA escolheu enviar uma mídia associada (PDF, Vídeo, Áudio)
            if (sdrResult.media) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              await sendMediaMessage(
                activeChannel,
                phone,
                sdrResult.media.type,
                { link: sdrResult.media.url },
                sdrResult.media.filename
              );
              console.log(`📤 Mídia enviada para ${phone}: [${sdrResult.media.type}] URL: ${sdrResult.media.url}`);
            }
          } catch (err) {
            console.error(`❌ Erro ao enviar resposta para ${phone}:`, err);
          }
        }, totalDelay);

        activeDelays.set(delayKey, timeoutId);
      }
    } catch (error) {
      console.error('❌ Erro no webhook Meta:', error);
    }
  }
  // 2. Se for o webhook da Evolution API
  else if (body.event === 'messages.upsert') {
    try {
      if (!res.headersSent) {
        res.sendStatus(200);
      }

      const instance = body.instance;
      const data = body.data;
      if (!data || !data.key) return;

      const fromMe = data.key.fromMe;
      if (fromMe) {
        // Ignora mensagens enviadas pelo próprio bot, mas detecta intervenção do agente humano
        const remoteJid = data.key.remoteJid;
        if (remoteJid && remoteJid.includes('@s.whatsapp.net')) {
          const phone = remoteJid.split('@')[0];
          const activeChannel = instance;
          
          let textToCheck = '';
          const message = data.message || {};
          if (message.conversation) {
            textToCheck = message.conversation;
          } else if (message.extendedTextMessage) {
            textToCheck = message.extendedTextMessage.text || '';
          } else if (message.imageMessage) {
            textToCheck = message.imageMessage.caption || '';
          } else if (message.videoMessage) {
            textToCheck = message.videoMessage.caption || '';
          } else if (message.documentMessage) {
            textToCheck = message.documentMessage.title || message.documentMessage.fileName || '';
          } else if (message.audioMessage) {
            textToCheck = 'audio';
          }

          const isMedia = !!(message.imageMessage || message.videoMessage || message.documentMessage || message.audioMessage);
          if (isMedia) {
            const isBotMedia = botTracker.hasAndConsume(phone, textToCheck) || 
                               botTracker.hasAndConsume(phone, 'media') || 
                               botTracker.hasAndConsume(phone, 'audio') || 
                               botTracker.hasAndConsume(phone, 'document') || 
                               botTracker.hasAndConsume(phone, 'image');
            if (!isBotMedia) {
              console.log(`[HUMAN INTERVENTION DETECTED - EVOLUTION MEDIA] O vendedor humano enviou uma mídia manual para ${phone}. Parando a IA.`);
              try {
                const lead = await LeadState.getLead(phone, activeChannel);
                lead.requires_intervention = true;
                await LeadState.saveLead(lead);
              } catch (err) {
                console.error('Erro ao marcar requires_intervention no Evolution:', err);
              }
            }
            return;
          }

          const isBot = botTracker.hasAndConsume(phone, textToCheck);
          if (!isBot) {
            console.log(`[HUMAN INTERVENTION DETECTED - EVOLUTION] O vendedor humano enviou uma mensagem manual para ${phone}: "${textToCheck}". Parando a IA.`);
            try {
              const lead = await LeadState.getLead(phone, activeChannel);
              lead.requires_intervention = true;
              await LeadState.saveLead(lead);
            } catch (err) {
              console.error('Erro ao marcar requires_intervention no Evolution:', err);
            }
          }
        }
        return;
      }

      const remoteJid = data.key.remoteJid;
      if (!remoteJid || !remoteJid.includes('@s.whatsapp.net')) return;

      const phone = remoteJid.split('@')[0];
      const contactName = data.pushName || 'Lead';
      const activeChannel = instance; // usamos o nome da instância como o ID do canal

      // Extrai o texto da mensagem
      const message = data.message;
      if (!message) return;

      let userText = '';
      if (message.conversation) {
        userText = message.conversation;
      } else if (message.extendedTextMessage) {
        userText = message.extendedTextMessage.text || '';
      } else if (message.imageMessage) {
        userText = message.imageMessage.caption || '';
      } else if (message.videoMessage) {
        userText = message.videoMessage.caption || '';
      }

      // Se não tiver texto legível, ignora
      if (!userText.trim()) return;

      console.log(`\n📩 [EVOLUTION CANAL: ${activeChannel}] Mensagem de ${contactName} (${phone}): ${userText}`);

      // Pega ou cria o Lead escopado por canal
      let lead = await LeadState.getLead(phone, activeChannel);
      if (!lead.name || lead.name === 'Lead') {
        lead.name = contactName;
        await LeadState.saveLead(lead);
      }

      // Salva a mensagem no histórico do lead
      await LeadState.addMessage(phone, activeChannel, 'user', userText);

      // Cancelar qualquer resposta pendente para este usuário (debouncing)
      const delayKey = `${phone}_${activeChannel}`;
      if (activeDelays.has(delayKey)) {
        clearTimeout(activeDelays.get(delayKey));
        activeDelays.delete(delayKey);
      }

      // Calcula o delay de resposta consultiva (debouncing e humanização)
      const charCount = userText.length;
      const baseDelay = 5000;
      const perCharDelay = Math.min(charCount * 40, 10000);
      const randomDelay = Math.floor(Math.random() * 4000) + 2000;
      const totalDelay = baseDelay + perCharDelay + randomDelay;

      const baseUrl = `${req.protocol}://${req.get('host')}`;

      const timeoutId = setTimeout(async () => {
        activeDelays.delete(delayKey);
        try {
          // Recarrega o lead atualizado
          const updatedLead = await LeadState.getLead(phone, activeChannel);

          // Se o corretor humano interveio, cancela a resposta da IA
          if (updatedLead.requires_intervention) {
            console.log(`[AI SDR STOPPED - EVOLUTION] O corretor interveio para o lead ${phone}. AI não responderá.`);
            return;
          }

          // Gera a resposta consultiva usando o Gemini
          const sdrResult = await generateSdrResponse(updatedLead, baseUrl);
          if (sdrResult.stage !== updatedLead.stage) {
            await LeadState.updateStage(phone, activeChannel, sdrResult.stage);
            console.log(`🔄 Lead ${updatedLead.name} avançou para fase: ${sdrResult.stage}`);
          }

          // Salva a resposta no histórico (incluindo mídias sugeridas se houver)
          await LeadState.addMessage(phone, activeChannel, 'assistant', sdrResult.response, sdrResult.media);

          // Divide a resposta em mensagens consecutivas
          const chunks = splitMessage(sdrResult.response);
          console.log(`📤 Enviando resposta dividida em ${chunks.length} mensagens para ${phone}...`);

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const delay = getTypingDelay(chunk);
            await new Promise(resolve => setTimeout(resolve, delay));
            await sendMessage(activeChannel, phone, chunk);
          }

          // Se a IA escolheu enviar uma mídia associada (PDF, Vídeo, Áudio)
          if (sdrResult.media) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            await sendMediaMessage(
              activeChannel,
              phone,
              sdrResult.media.type,
              { link: sdrResult.media.url },
              sdrResult.media.filename
            );
            console.log(`📤 Mídia enviada para ${phone}: [${sdrResult.media.type}] URL: ${sdrResult.media.url}`);
          }
        } catch (err) {
          console.error(`❌ Erro ao enviar resposta Evolution para ${phone}:`, err);
        }
      }, totalDelay);

      activeDelays.set(delayKey, timeoutId);
    } catch (error) {
      console.error('❌ Erro no webhook Evolution:', error);
    }
  }
  // 3. Se for o webhook do Whaticket / Z-PRO
  else if (body.method === 'message' && body.msg && body.ticket) {
    try {
      if (!res.headersSent) {
        res.sendStatus(200);
      }

      const msg = body.msg;
      const ticket = body.ticket;
      const contact = ticket.contact || {};

      // Salva log de webhook para depuração
      await LeadState.saveWebhookLog('whaticket_payload', { msg, ticket });

      // Ignora mensagens que o próprio bot enviou, mas detecta intervenção do agente humano
      if (msg.fromMe === true) {
        const phone = contact.number || msg.from;
        const activeChannel = String(ticket.whatsappId || 'default');
        
        if (phone) {
          let textToCheck = '';
          if (msg.text && msg.text.body) {
            textToCheck = msg.text.body;
          } else if (typeof msg.body === 'string') {
            textToCheck = msg.body;
          }

          // Se for mídia, tenta bater com o nome do arquivo ou tipo
          const isMedia = !!(msg.mediaUrl || msg.url);
          if (isMedia) {
            const filename = msg.document?.filename || msg.filename || '';
            const type = msg.mediaType || '';
            const isBotMedia = botTracker.hasAndConsume(phone, filename) || 
                               botTracker.hasAndConsume(phone, type) ||
                               botTracker.hasAndConsume(phone, 'media') ||
                               botTracker.hasAndConsume(phone, textToCheck);
            if (!isBotMedia) {
              console.log(`[HUMAN INTERVENTION DETECTED - WHATICKET MEDIA] O vendedor humano enviou uma mídia manual para ${phone}. Parando a IA.`);
              try {
                const lead = await LeadState.getLead(phone, activeChannel);
                lead.requires_intervention = true;
                await LeadState.saveLead(lead);
              } catch (err) {
                console.error('Erro ao marcar requires_intervention no Whaticket:', err);
              }
            }
          } else {
            const isBot = botTracker.hasAndConsume(phone, textToCheck);
            if (!isBot) {
              console.log(`[HUMAN INTERVENTION DETECTED - WHATICKET] O vendedor humano enviou uma mensagem manual para ${phone}: "${textToCheck}". Parando a IA.`);
              try {
                const lead = await LeadState.getLead(phone, activeChannel);
                lead.requires_intervention = true;
                await LeadState.saveLead(lead);
              } catch (err) {
                console.error('Erro ao marcar requires_intervention no Whaticket:', err);
              }
            }
          }
        }
        return;
      }

      // Evita duplicação de mensagens vindas do Whaticket/Z-PRO
      const messageId = msg.id;
      if (messageId) {
        if (processedMessageIds.has(messageId)) {
          console.log(`⚠️ [WEBHOOK WHATICKET] Ignorando mensagem duplicada (ID: ${messageId})`);
          return;
        }
        processedMessageIds.add(messageId);
        if (processedMessageIds.size > 500) {
          const firstAdded = Array.from(processedMessageIds)[0];
          processedMessageIds.delete(firstAdded);
        }
      }

      const phone = msg.from || contact.number;
      if (!phone) return;

      const contactName = contact.name || contact.pushname || 'Lead';
      const activeChannel = String(ticket.whatsappId || 'default'); // ID da conexão

      // Extrai o texto da mensagem
      let userText = '';
      let isWhaticketMedia = false;

      let mediaUrl = msg.mediaUrl || msg.url;
      let mimeType = msg.mediaType || '';
      let filename = msg.document?.filename || msg.filename || '';

      if (!mediaUrl) {
        if (msg.image && msg.image.url) {
          mediaUrl = msg.image.url;
          mimeType = msg.image.mime_type || 'image/jpeg';
        } else if (msg.document && msg.document.url) {
          mediaUrl = msg.document.url;
          mimeType = msg.document.mime_type || 'application/pdf';
          filename = msg.document.filename || '';
        } else if (msg.audio && msg.audio.url) {
          mediaUrl = msg.audio.url;
          mimeType = msg.audio.mime_type || 'audio/ogg';
        } else if (msg.video && msg.video.url) {
          mediaUrl = msg.video.url;
          mimeType = msg.video.mime_type || 'video/mp4';
        }
      }

      if (mediaUrl) {
        if (!mediaUrl.startsWith('http')) {
          const whaticketApiUrl = process.env.WHATICKET_API_URL || 'https://api.perellicorretora.com.br';
          const cleanUrl = whaticketApiUrl.replace(/\/$/, '');
          mediaUrl = `${cleanUrl}/${mediaUrl.replace(/^\//, '')}`;
        }

        if (!mimeType) {
          mimeType = mediaUrl.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
        }

        const isImageOrPdf = mimeType.startsWith('image/') || mimeType === 'application/pdf';

        if (isImageOrPdf) {
          try {
            console.log(`\n📩 [WHATICKET] Baixando mídia de: ${mediaUrl}`);
            const headers: HeadersInit = {};
            if (mediaUrl.includes('lookaside.fbsbx.com') || mediaUrl.includes('facebook.com')) {
              const bmToken = ticket?.whatsapp?.bmToken;
              if (bmToken) {
                headers['Authorization'] = `Bearer ${bmToken}`;
                console.log(`🔑 Usando token WABA para baixar mídia do Facebook.`);
              }
            }
            
            const resMedia = await fetch(mediaUrl, { headers });
            if (resMedia.ok) {
              const buffer = Buffer.from(await resMedia.arrayBuffer());
              const analysis = await analyzeDocument(buffer, mimeType);
              userText = `[Imagem enviada - Tipo: ${analysis.detectedType}, Legível: ${analysis.isReadable}, É Documento: ${analysis.isDocument}, Feedback: ${analysis.feedback}]`;
              isWhaticketMedia = true;
              console.log(`📝 Análise de mídia do Whaticket de ${contactName}: "${userText}"`);

              await updateLeadDocStatus(phone, activeChannel, analysis);
              // Log no banco
              await LeadState.saveWebhookLog('whaticket_media_success', { phone, mediaUrl, analysis });
            } else {
              const errText = `Falha ao baixar mídia do Whaticket. Status: ${resMedia.status} ${resMedia.statusText}`;
              console.error(`❌ ${errText}`);
              await LeadState.saveWebhookLog('whaticket_media_error', { phone, mediaUrl, status: resMedia.status, statusText: resMedia.statusText }, errText);
            }
          } catch (err: any) {
            console.error('Erro ao baixar mídia do Whaticket:', err);
            await LeadState.saveWebhookLog('whaticket_media_exception', { phone, mediaUrl }, err.message || String(err));
          }
        } else if (mimeType.startsWith('audio/')) {
          try {
            console.log(`\n📩 [WHATICKET] Baixando áudio de: ${mediaUrl}`);
            const headers: HeadersInit = {};
            if (mediaUrl.includes('lookaside.fbsbx.com') || mediaUrl.includes('facebook.com')) {
              const bmToken = ticket?.whatsapp?.bmToken;
              if (bmToken) {
                headers['Authorization'] = `Bearer ${bmToken}`;
                console.log(`🔑 Usando token WABA para baixar áudio do Facebook.`);
              }
            }

            const resMedia = await fetch(mediaUrl, { headers });
            if (resMedia.ok) {
              const buffer = Buffer.from(await resMedia.arrayBuffer());
              userText = await transcribeAudio(buffer, mimeType);
              isWhaticketMedia = true;
              console.log(`📝 Áudio transcrevido do Whaticket de ${contactName}: "${userText}"`);
            } else {
              console.error(`❌ Falha ao baixar áudio do Whaticket. Status: ${resMedia.status}`);
            }
          } catch (err: any) {
            console.error('Erro ao baixar/transcrever áudio do Whaticket:', err);
          }
        } else {
          console.log(`⚠️ Tipo de mídia não processável: ${mimeType}`);
        }
      }

      if (!isWhaticketMedia) {
        if (msg.text && msg.text.body) {
          userText = msg.text.body;
        } else if (typeof msg.body === 'string') {
          userText = msg.body;
        }
      }

      if (!userText.trim()) return;

      console.log(`\n📩 [WHATICKET CANAL: ${activeChannel}] Mensagem de ${contactName} (${phone}): ${userText}`);

      // Pega ou cria o Lead escopado por canal
      let lead = await LeadState.getLead(phone, activeChannel);
      if (!lead.name || lead.name === 'Lead') {
        lead.name = contactName;
        await LeadState.saveLead(lead);
      }

      // Detecção de intervenção baseada no status ou atribuição do ticket no Z-PRO desativada para evitar falsos positivos
      // (a detecção real ocorre quando o vendedor envia uma mensagem de fato: msg.fromMe === true)

      // Se o corretor humano interveio ou a IA está pausada para este lead, retorna imediatamente antes de salvar mensagem e agendar resposta
      if (lead.requires_intervention) {
        console.log(`[AI SDR BYPASSED - WHATICKET] O corretor interveio para o lead ${phone}. AI não responderá.`);
        return;
      }

      // Salva a mensagem no histórico do lead
      await LeadState.addMessage(phone, activeChannel, 'user', userText);

      const delayKey = `${phone}_${activeChannel}`;

      // Se já estamos enviando uma resposta para este lead, enfileira o processamento
      if (activeSending.has(delayKey)) {
        console.log(`⏳ [WEBHOOK WHATICKET] Lead ${phone} está enviando. Enfileirando resposta.`);
        pendingProcessing.set(delayKey, true);
        return;
      }

      // Limpa qualquer follow-up ativo
      clearFollowUpTimer(phone, activeChannel);

      // Cancelar qualquer resposta pendente para este usuário (debouncing antes de começar a enviar)
      if (activeDelays.has(delayKey)) {
        clearTimeout(activeDelays.get(delayKey));
        activeDelays.delete(delayKey);
      }

      // Delay de resposta consultiva (debouncing e humanização)
      const charCount = userText.length;
      const baseDelay = 5000;
      const perCharDelay = Math.min(charCount * 40, 10000);
      const randomDelay = Math.floor(Math.random() * 4000) + 2000;
      const totalDelay = baseDelay + perCharDelay + randomDelay;

      const baseUrl = `${req.protocol}://${req.get('host')}`;

      const timeoutId = setTimeout(async () => {
        activeDelays.delete(delayKey);
        await triggerNextResponse(phone, activeChannel, baseUrl);
      }, totalDelay);

      activeDelays.set(delayKey, timeoutId);
    } catch (error) {
      console.error('❌ Erro no webhook Whaticket:', error);
    }
  } else {
    // Se não for nenhum dos três, apenas encerra com 200 para evitar loops da API externa
    if (!res.headersSent) res.sendStatus(200);
  }
});

// Rota para listar documentos disponíveis
whatsappRouter.get('/api/documents', (req: Request, res: Response) => {
  try {
    const docsDir = path.join(__dirname, '../../documentos');
    if (!fs.existsSync(docsDir)) {
      return res.json([]);
    }
    const files = fs.readdirSync(docsDir);
    const docsInfo = files.map(file => {
      const filePath = path.join(docsDir, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        url: `/documentos/${file}`
      };
    });
    res.json(docsInfo);
  } catch (err: any) {
    console.error('Erro ao listar documentos:', err);
    res.status(500).json({ error: err.message });
  }
});

// Rota para upload de novos documentos com git commit e push automáticos
whatsappRouter.post('/api/upload-document', async (req: Request, res: Response) => {
  const filename = req.query.filename as string;
  if (!filename) {
    return res.status(400).json({ error: 'O nome do arquivo (filename) é obrigatório.' });
  }

  const safeFilename = path.basename(filename);

  try {
    const docsDir = path.join(__dirname, '../../documentos');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    const targetPath = path.join(docsDir, safeFilename);
    const writeStream = fs.createWriteStream(targetPath);

    req.pipe(writeStream);

    writeStream.on('finish', async () => {
      console.log(`✅ Arquivo salvo localmente em: ${targetPath}`);

      try {
        const projDir = path.join(__dirname, '../..');
        
        console.log(`[GIT COMMIT] Adicionando e commitando: ${safeFilename}`);
        await execPromise(`git add documentos/"${safeFilename}"`, { cwd: projDir });
        await execPromise(`git commit -m "docs: upload automatico de ${safeFilename}"`, { cwd: projDir });
        
        console.log(`[GIT PUSH] Puxando para origin main...`);
        exec(`git push origin main`, { cwd: projDir }, (pushErr, stdout, stderr) => {
          if (pushErr) {
            console.error(`❌ Erro no push do Git para ${safeFilename}:`, pushErr);
          } else {
            console.log(`✅ Git push realizado com sucesso para ${safeFilename}:`, stdout);
          }
        });

        res.json({ success: true, url: `/documentos/${safeFilename}` });
      } catch (gitErr: any) {
        console.error(`⚠️ Erro ao commitar no Git:`, gitErr);
        res.json({ 
          success: true, 
          url: `/documentos/${safeFilename}`, 
          warning: `Arquivo salvo com sucesso, mas o commit no Git falhou: ${gitErr.message}` 
        });
      }
    });

    writeStream.on('error', (streamErr) => {
      console.error('Erro na gravação do stream do arquivo:', streamErr);
      res.status(500).json({ error: 'Erro ao gravar o arquivo no disco.' });
    });

  } catch (err: any) {
    console.error('Erro no processamento do upload:', err);
    res.status(500).json({ error: err.message });
  }
});

function clearFollowUpTimer(phone: string, activeChannel: string) {
  const delayKey = `${phone}_${activeChannel}`;
  if (followUpTimers.has(delayKey)) {
    clearTimeout(followUpTimers.get(delayKey));
    followUpTimers.delete(delayKey);
  }
}

function resetFollowUpTimer(phone: string, activeChannel: string) {
  clearFollowUpTimer(phone, activeChannel);
  const delayKey = `${phone}_${activeChannel}`;
  const timerId = setTimeout(async () => {
    followUpTimers.delete(delayKey);
    await triggerFollowUp(phone, activeChannel);
  }, 5 * 60 * 1000); // 5 minutos
  followUpTimers.set(delayKey, timerId);
}

async function triggerFollowUp(phone: string, activeChannel: string) {
  try {
    const lead = await LeadState.getLead(phone, activeChannel);
    if (lead.stage === 'CONVERTED' || lead.stage === 'LOST' || lead.status !== 'active' || lead.requires_intervention) {
      return;
    }

    const lastMsg = lead.history[lead.history.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') {
      return;
    }

    console.log(`[FOLLOW-UP] Lead ${lead.name || phone} inativo há 5 minutos. Disparando follow-up...`);
    const followUpText = await generateFollowUp(lead);
    
    await LeadState.addMessage(phone, activeChannel, 'assistant', followUpText);
    await sendMessage(activeChannel, phone, followUpText);
  } catch (error) {
    console.error('❌ Erro no triggerFollowUp:', error);
  }
}

async function updateLeadDocStatus(phone: string, channelPhoneId: string, analysis: { detectedType: string, isReadable: boolean, isDocument: boolean, feedback: string }) {
  try {
    const lead = await LeadState.getLead(phone, channelPhoneId);
    let docStatus = { rg_cnh: null as any, residence: null as any };
    if (lead.document_status) {
      try {
        docStatus = JSON.parse(lead.document_status);
      } catch (_) {}
    }

    if (analysis.isDocument && analysis.isReadable) {
      if (analysis.detectedType === 'rg' || analysis.detectedType === 'cnh') {
        docStatus.rg_cnh = { type: analysis.detectedType, valid: true, feedback: analysis.feedback };
      } else if (analysis.detectedType === 'comprovante_residencia') {
        docStatus.residence = { type: 'comprovante_residencia', valid: true, feedback: analysis.feedback };
      }
    } else {
      if (analysis.detectedType === 'rg' || analysis.detectedType === 'cnh') {
        docStatus.rg_cnh = { type: analysis.detectedType, valid: false, feedback: analysis.feedback };
      } else if (analysis.detectedType === 'comprovante_residencia') {
        docStatus.residence = { type: 'comprovante_residencia', valid: false, feedback: analysis.feedback };
      }
    }
    lead.document_status = JSON.stringify(docStatus);
    await LeadState.saveLead(lead);
  } catch (err) {
    console.error('Erro ao atualizar document_status do lead:', err);
  }
}

async function triggerNextResponse(phone: string, activeChannel: string, baseUrl: string) {
  const delayKey = `${phone}_${activeChannel}`;
  if (activeSending.has(delayKey)) return;

  try {
    activeSending.add(delayKey);

    const updatedLead = await LeadState.getLead(phone, activeChannel);
    
    // Se o corretor humano interveio, cancela a resposta da IA
    if (updatedLead.requires_intervention) {
      console.log(`[AI SDR STOPPED - WHATICKET] O corretor interveio para o lead ${phone}. AI não responderá.`);
      return;
    }

    const lastMsg = updatedLead.history[updatedLead.history.length - 1];
    if (!lastMsg || lastMsg.role !== 'user') return;

    const sdrResult = await generateSdrResponse(updatedLead, baseUrl);
    if (sdrResult.stage !== updatedLead.stage) {
      await LeadState.updateStage(phone, activeChannel, sdrResult.stage);
      console.log(`🔄 Lead ${updatedLead.name} avançou para fase: ${sdrResult.stage}`);
    }

    await LeadState.addMessage(phone, activeChannel, 'assistant', sdrResult.response, sdrResult.media);

    // Envio por áudio de voz da ElevenLabs (se o Gemini decidir ou se o cliente mandou áudio e a API key estiver configurada)
    let audioSentSuccessfully = false;
    const lastUserMsgText = lastMsg.content || '';
    const wasAudioInput = lastUserMsgText.includes('[Áudio enviado') || 
                         lastUserMsgText.includes('[audio') || 
                         lastUserMsgText.includes('audio');
    const shouldSendAudio = (sdrResult.send_audio === true || wasAudioInput) && env.ELEVENLABS_API_KEY;

    if (shouldSendAudio) {
      console.log(`🎙️ [TTS ELEVENLABS - WHATICKET] Gerando áudio de voz para ${phone}...`);
      const voiceBuffer = await generateSpeech(sdrResult.response);
      if (voiceBuffer) {
        try {
          const timestamp = Date.now();
          const audioFilename = `voice_${phone}_${timestamp}.mp3`;
          const localPath = path.join(__dirname, '../../documentos', audioFilename);
          
          // Garante que a pasta documentos existe
          fs.mkdirSync(path.dirname(localPath), { recursive: true });
          fs.writeFileSync(localPath, voiceBuffer);
          
          const voiceUrl = `${baseUrl.replace(/\/$/, '')}/documentos/${audioFilename}`;
          console.log(`🎙️ [TTS ELEVENLABS - WHATICKET] Áudio salvo localmente em ${localPath}. Link: ${voiceUrl}`);
          
          // Simula o tempo de gravação do áudio (tempo de digitação)
          const delay = getTypingDelay(sdrResult.response);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          await sendMediaMessage(activeChannel, phone, 'audio', { link: voiceUrl }, 'audio.mp3');
          audioSentSuccessfully = true;
          console.log(`🎙️ [TTS ELEVENLABS - WHATICKET] Áudio enviado com sucesso para ${phone}`);
        } catch (audioErr) {
          console.error(`❌ [TTS FALLBACK - WHATICKET] Erro ao gravar/enviar áudio:`, audioErr);
        }
      }
    }

    // Fallback: Envia mensagem normal de texto se a IA não pediu áudio ou se a geração do áudio falhou
    if (!audioSentSuccessfully) {
      const chunks = splitMessage(sdrResult.response);
      console.log(`📤 Enviando resposta Whaticket em ${chunks.length} mensagens para ${phone}...`);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const delay = getTypingDelay(chunk);
        await new Promise(resolve => setTimeout(resolve, delay));
        await sendMessage(activeChannel, phone, chunk);
      }
    }

    if (sdrResult.media) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      let finalMediaUrl = sdrResult.media.url;
      let dynamicAudioGenerated = false;

      // Se a mídia for do tipo áudio, gera o arquivo de áudio sob demanda usando ElevenLabs
      if (sdrResult.media.type === 'audio' && env.ELEVENLABS_API_KEY) {
        console.log(`🎙️ [TTS ELEVENLABS - MEDIA AUDIO] Gerando áudio explicativo sob demanda para ${phone}...`);
        const explanationText = sdrResult.response || "Vou te explicar como funciona.";
        const voiceBuffer = await generateSpeech(explanationText);
        if (voiceBuffer) {
          try {
            const timestamp = Date.now();
            const audioFilename = `explicativo_${phone}_${timestamp}.mp3`;
            const localPath = path.join(__dirname, '../../documentos', audioFilename);
            
            fs.mkdirSync(path.dirname(localPath), { recursive: true });
            fs.writeFileSync(localPath, voiceBuffer);
            
            finalMediaUrl = `${baseUrl.replace(/\/$/, '')}/documentos/${audioFilename}`;
            dynamicAudioGenerated = true;
            console.log(`🎙️ [TTS ELEVENLABS - MEDIA AUDIO] Áudio dinâmico gerado em: ${finalMediaUrl}`);
          } catch (audioErr) {
            console.error(`❌ [TTS FALLBACK - MEDIA AUDIO] Falha ao gerar áudio dinâmico, usando estático:`, audioErr);
          }
        }
      }

      await sendMediaMessage(
        activeChannel,
        phone,
        sdrResult.media.type,
        { link: finalMediaUrl },
        sdrResult.media.filename
      );
      console.log(`📤 Mídia enviada para ${phone}: [${sdrResult.media.type}] URL: ${finalMediaUrl}`);
    }

    resetFollowUpTimer(phone, activeChannel);

  } catch (err) {
    console.error(`❌ Erro ao enviar resposta Whaticket para ${phone}:`, err);
  } finally {
    activeSending.delete(delayKey);

    if (pendingProcessing.get(delayKey)) {
      pendingProcessing.delete(delayKey);
      console.log(`🔄 [QUEUE] Processando mensagem enfileirada para ${phone}...`);
      setTimeout(async () => {
        await triggerNextResponse(phone, activeChannel, baseUrl);
      }, 2000);
    }
  }
}

// Helper para obter credenciais do canal
export async function getChannelConfig(channelPhoneId: string): Promise<{ phone_number_id: string, access_token: string, display_phone_number: string, name: string }> {
  try {
    const db = await getDb();
    if (db && isDbConnected && channelPhoneId && channelPhoneId !== 'default') {
      const res = await db.query('SELECT * FROM whatsapp_channels WHERE phone_number_id = $1', [channelPhoneId]);
      const row = res.rows[0];
      if (row) {
        return {
          phone_number_id: row.phone_number_id,
          access_token: row.access_token || env.META_ACCESS_TOKEN,
          display_phone_number: row.display_phone_number,
          name: row.name
        };
      }
    }
  } catch (err) {
    console.error('Erro ao ler whatsapp_channels no banco, usando fallback:', err);
  }

  // Fallback default
  return {
    phone_number_id: env.META_PHONE_ID || 'default',
    access_token: env.META_ACCESS_TOKEN || '',
    display_phone_number: 'default',
    name: 'Canal Principal'
  };
}

// Helper para envio de mensagem via Whaticket / Z-PRO
export async function sendWhaticketMessage(whatsappId: string, to: string, text: string, apiKeyAndApiId: string) {
  try {
    const baseUrl = process.env.WHATICKET_API_URL || 'https://api.perellicorretora.com.br';
    const cleanUrl = baseUrl.replace(/\/$/, '');
    const cleanNumber = to.replace(/\D/g, '');

    // Separa API Key e ApiID se houver
    const parts = apiKeyAndApiId.split(';');
    const apiKey = parts[0];
    const apiId = parts[1];

    if (!apiId) {
      console.warn(`⚠️ [WHATICKET] Envio cancelado: ApiID (UUID) não configurado no access_token do canal Whaticket ID ${whatsappId}.`);
      return;
    }

    const response = await fetch(`${cleanUrl}/v2/api/external/${apiId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        number: cleanNumber,
        body: text,
        whatsappId: parseInt(whatsappId) || 39,
        externalKey: "sdr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7)
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro da API Whaticket no canal ${whatsappId} (Status ${response.status}):`, errorText);
    } else {
      const data = await response.json() as any;
      console.log(`✅ Mensagem enviada com sucesso via Whaticket API para ${cleanNumber}`);
    }
  } catch (err) {
    console.error('❌ Erro de rede ao tentar enviar via Whaticket API:', err);
  }
}

// Helper para envio de mídia via Whaticket / Z-PRO
export async function sendWhaticketMediaMessage(
  whatsappId: string,
  to: string,
  type: 'image' | 'document' | 'audio' | 'video',
  media: { link?: string },
  filename?: string,
  apiKeyAndApiId?: string
) {
  try {
    const baseUrl = process.env.WHATICKET_API_URL || 'https://api.perellicorretora.com.br';
    const cleanUrl = baseUrl.replace(/\/$/, '');
    const cleanNumber = to.replace(/\D/g, '');

    if (!media.link) {
      console.warn('⚠️ Envio de mídia via Whaticket sem link ignorado.');
      return;
    }

    // Separa API Key e ApiID se houver
    const parts = (apiKeyAndApiId || '').split(';');
    const apiKey = parts[0];
    const apiId = parts[1];

    if (!apiId) {
      console.warn(`⚠️ [WHATICKET] Envio de mídia cancelado: ApiID (UUID) não configurado no access_token do canal Whaticket ID ${whatsappId}.`);
      return;
    }

    // Baixa o arquivo do nosso servidor
    const fileRes = await fetch(media.link);
    if (!fileRes.ok) {
      throw new Error(`Falha ao baixar arquivo para reenvio: ${fileRes.statusText}`);
    }
    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Constrói o Form Data
    const formData = new FormData();
    formData.append('number', cleanNumber);
    formData.append('whatsappId', whatsappId);
    formData.append('externalKey', "sdr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7));
    formData.append('body', filename || (type === 'document' ? 'documento.pdf' : type === 'audio' ? 'audio.mp3' : 'imagem.png'));
    
    let mimeType = 'application/octet-stream';
    if (type === 'document') {
      mimeType = 'application/pdf';
    } else if (type === 'audio') {
      mimeType = 'audio/mpeg';
    } else if (type === 'image') {
      mimeType = 'image/png';
    }

    const defaultFilename = type === 'document' ? 'documento.pdf' : type === 'audio' ? 'audio.mp3' : 'imagem.png';
    const fileBlob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    formData.append('media', fileBlob, filename || defaultFilename);

    const response = await fetch(`${cleanUrl}/v2/api/external/${apiId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro de mídia da API Whaticket no canal ${whatsappId} (Status ${response.status}):`, errorText);
    } else {
      const data = await response.json() as any;
      console.log(`✅ Mídia [${type}] enviada com sucesso via Whaticket API para ${cleanNumber}`);
    }
  } catch (err) {
    console.error('❌ Erro de rede ao tentar enviar mídia via Whaticket API:', err);
  }
}

// Helper para envio de mensagem via Evolution API
export async function sendEvolutionMessage(instance: string, to: string, text: string, apiKey: string) {
  try {
    const baseUrl = process.env.EVOLUTION_API_URL || 'https://api.perellicorretora.com.br';
    const cleanUrl = baseUrl.replace(/\/$/, '');
    const cleanNumber = to.replace(/\D/g, '');

    const response = await fetch(`${cleanUrl}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        number: cleanNumber,
        textMessage: {
          text: text
        },
        options: {
          delay: 1000,
          presence: 'composing'
        }
      })
    });

    const data = await response.json() as any;
    if (!response.ok) {
      console.error(`❌ Erro da API Evolution no canal ${instance} ao enviar:`, JSON.stringify(data, null, 2));
    } else {
      console.log(`✅ Mensagem enviada com sucesso via Evolution API para ${cleanNumber}`);
    }
  } catch (err) {
    console.error('❌ Erro de rede ao tentar enviar via Evolution API:', err);
  }
}

// Helper para envio de mídia via Evolution API
export async function sendEvolutionMediaMessage(
  instance: string,
  to: string,
  type: 'image' | 'document' | 'audio' | 'video',
  media: { link?: string },
  filename?: string,
  apiKey?: string
) {
  try {
    const baseUrl = process.env.EVOLUTION_API_URL || 'https://api.perellicorretora.com.br';
    const cleanUrl = baseUrl.replace(/\/$/, '');
    const cleanNumber = to.replace(/\D/g, '');

    if (!media.link) {
      console.warn('⚠️ Envio de mídia via Evolution sem link ignorado.');
      return;
    }

    let mimeType = 'application/octet-stream';
    if (type === 'document') {
      mimeType = 'application/pdf';
    } else if (type === 'audio') {
      mimeType = 'audio/mpeg';
    } else if (type === 'image') {
      mimeType = 'image/png';
    }

    const payload = {
      number: cleanNumber,
      mediatype: type === 'audio' ? 'audio' : type === 'document' ? 'document' : 'image',
      mimetype: mimeType,
      media: media.link,
      fileName: filename || (type === 'document' ? 'documento.pdf' : type === 'audio' ? 'audio.mp3' : 'imagem.png')
    };

    const response = await fetch(`${cleanUrl}/message/sendMedia/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey || ''
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json() as any;
    if (!response.ok) {
      console.error(`❌ Erro de mídia da API Evolution no canal ${instance} ao enviar:`, JSON.stringify(data, null, 2));
    } else {
      console.log(`✅ Mídia [${type}] enviada com sucesso via Evolution API para ${cleanNumber}`);
    }
  } catch (err) {
    console.error('❌ Erro de rede ao tentar enviar mídia via Evolution API:', err);
  }
}

// Funções de chamada da API do WhatsApp Cloud (Graph API) ou gateways alternativos
export async function sendMessage(channelPhoneId: string, to: string, text: string) {
  try {
    botTracker.track(to, text);
    const config = await getChannelConfig(channelPhoneId);
    if (!config.access_token || config.phone_number_id === 'default') {
      console.warn(`⚠️ Envio de mensagem ignorado: Canal '${channelPhoneId}' sem chave cadastrada.`);
      return;
    }

    // Deteção do tipo de canal
    const isWhaticket = /^\d+$/.test(config.phone_number_id);
    const isEvolution = !config.access_token.startsWith('EAA') && !isWhaticket;

    if (isWhaticket) {
      await sendWhaticketMessage(config.phone_number_id, to, text, config.access_token);
      return;
    } else if (isEvolution) {
      await sendEvolutionMessage(config.phone_number_id, to, text, config.access_token);
      return;
    }

    const response = await fetch(`https://graph.facebook.com/v20.0/${config.phone_number_id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: text }
      })
    });

    const data = await response.json() as any;
    if (response.ok && data.messages?.[0]?.id) {
      const wamid = data.messages[0].id;
      botSentWamids.add(wamid);
      setTimeout(() => botSentWamids.delete(wamid), 300000); // 5 min TTL
    } else if (!response.ok) {
      console.error(`❌ Erro da API da Meta no canal ${config.name} ao enviar:`, JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('❌ Erro de rede ao tentar enviar a mensagem:', err);
  }
}

export async function sendTemplateMessage(channelPhoneId: string, to: string, templateName: string, parameters: string[]) {
  try {
    const config = await getChannelConfig(channelPhoneId);
    if (!config.access_token || config.phone_number_id === 'default') {
      console.warn(`⚠️ Envio de template ignorado: Canal '${channelPhoneId}' sem chave cadastrada.`);
      return;
    }

    const response = await fetch(`https://graph.facebook.com/v20.0/${config.phone_number_id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: 'pt_BR'
          },
          components: [
            {
              type: 'body',
              parameters: parameters.map(p => ({ type: 'text', text: p }))
            }
          ]
        }
      })
    });

    const data: any = await response.json();
    if (response.ok && data.messages?.[0]?.id) {
      const wamid = data.messages[0].id;
      botSentWamids.add(wamid);
      setTimeout(() => botSentWamids.delete(wamid), 300000); // 5 min TTL
    } else if (!response.ok) {
      console.error('❌ Erro da API da Meta ao enviar template:', JSON.stringify(data, null, 2));
      throw new Error(data.error?.message || 'Erro ao enviar template');
    }
  } catch (err: any) {
    console.error('❌ Falha ao chamar API de template da Meta:', err);
    throw err;
  }
}

export async function uploadMediaToMeta(channelPhoneId: string, buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  try {
    const config = await getChannelConfig(channelPhoneId);
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    formData.append('file', blob, filename);
    formData.append('messaging_product', 'whatsapp');

    const response = await fetch(`https://graph.facebook.com/v20.0/${config.phone_number_id}/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.access_token}`
      },
      body: formData
    });

    const data = await response.json() as any;
    if (!response.ok) {
      throw new Error(`Erro ao enviar mídia para a Meta: ${JSON.stringify(data)}`);
    }
    return data.id;
  } catch (error) {
    console.error('❌ Erro na função uploadMediaToMeta:', error);
    throw error;
  }
}

export async function sendMediaMessage(
  channelPhoneId: string,
  to: string,
  type: 'image' | 'document' | 'audio' | 'video',
  media: { id?: string; link?: string },
  filename?: string
) {
  try {
    const trackVal = filename || type || 'media';
    botTracker.track(to, trackVal);
    const config = await getChannelConfig(channelPhoneId);
    if (!config.access_token || config.phone_number_id === 'default') {
      console.warn(`⚠️ Envio de mídia ignorado: Canal '${channelPhoneId}' sem chave cadastrada.`);
      return;
    }

    const isWhaticket = /^\d+$/.test(config.phone_number_id);
    const isEvolution = !config.access_token.startsWith('EAA') && !isWhaticket;

    if (isWhaticket) {
      await sendWhaticketMediaMessage(config.phone_number_id, to, type, media, filename, config.access_token);
      return;
    } else if (isEvolution) {
      await sendEvolutionMediaMessage(config.phone_number_id, to, type, media, filename, config.access_token);
      return;
    }

    const payloadMedia: any = {};
    if (media.id) {
      payloadMedia.id = media.id;
    } else if (media.link) {
      payloadMedia.link = media.link;
    }

    if (type === 'document' && filename) {
      payloadMedia.filename = filename;
    }

    const response = await fetch(`https://graph.facebook.com/v20.0/${config.phone_number_id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: type,
        [type]: payloadMedia
      })
    });

    const data = await response.json() as any;
    if (response.ok && data.messages?.[0]?.id) {
      const wamid = data.messages[0].id;
      botSentWamids.add(wamid);
      setTimeout(() => botSentWamids.delete(wamid), 300000); // 5 min TTL
    } else if (!response.ok) {
      console.error(`❌ Erro da API da Meta ao enviar mídia (${type}):`, JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error(`❌ Erro de rede ao tentar enviar mídia (${type}):`, err);
  }
}

export async function generateSpeech(text: string): Promise<Buffer | null> {
  const apiKey = env.ELEVENLABS_API_KEY;
  const voiceId = env.ELEVENLABS_VOICE_ID;

  if (!apiKey) return null;

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=ogg_44100_96`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ElevenLabs (${response.status}): ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error('❌ [TTS] Falha ao gerar áudio com ElevenLabs:', err);
    return null;
  }
}

// GET /webhook-leads - Verificação de Webhook de Leads da Meta
whatsappRouter.get('/webhook-leads', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN) {
      console.log('✅ Webhook de Leads Ads verificado pela Meta!');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// POST /webhook-leads - Recepção de lead da Meta
whatsappRouter.post('/webhook-leads', async (req: Request, res: Response) => {
  const body = req.body;
  console.log('📬 [LEADS WEBHOOK INCOMING] Payload recebido:', JSON.stringify(body, null, 2));

  res.sendStatus(200);

  try {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const leadgenId = value?.leadgen_id;

    if (leadgenId) {
      console.log(`[LEADS WEBHOOK] Novo lead ID detectado: ${leadgenId}. Buscando dados na Graph API...`);
      
      const fbUrl = `https://graph.facebook.com/v20.0/${leadgenId}?access_token=${env.META_ACCESS_TOKEN}`;
      const fbRes = await fetch(fbUrl);
      if (!fbRes.ok) {
        throw new Error(`Erro ao buscar leadgen do Facebook: ${fbRes.statusText}`);
      }
      
      const fbData = await fbRes.json() as any;
      console.log(`[LEADS WEBHOOK] Dados retornados pelo Facebook:`, JSON.stringify(fbData, null, 2));

      let name = 'Lead';
      let phone = '';
      const fieldData = fbData.field_data || [];
      
      for (const field of fieldData) {
        const nameLower = field.name.toLowerCase();
        const val = field.values?.[0] || '';
        
        if (nameLower.includes('phone') || nameLower.includes('telefone') || nameLower.includes('whats') || nameLower.includes('celular')) {
          phone = val;
        } else if (nameLower.includes('name') || nameLower.includes('nome') || nameLower.includes('cliente')) {
          name = val;
        }
      }

      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone && cleanPhone.length >= 8) {
        console.log(`[LEADS WEBHOOK] Lead mapeado com sucesso: ${name} (${cleanPhone})`);
        
        const activeChannel = env.META_PHONE_ID || 'default';
        await LeadState.importLeads([{
          phone: cleanPhone,
          name: name,
          channel_phone_id: activeChannel,
          created_at: new Date().toISOString(),
          history: '[]',
          source: 'meta'
        }]);
        
        processPendingLeads().catch(err => console.error('Erro ao processar lead pendente do webhook:', err));
      } else {
        console.warn(`⚠️ [LEADS WEBHOOK] Telefone inválido ou não encontrado nos dados do lead: ${phone}`);
      }
    }
  } catch (error) {
    console.error('❌ [LEADS WEBHOOK] Erro ao processar webhook de leads da Meta:', error);
  }
});

// POST /api/leads/import - Rota para importação em lote de leads via CRM
whatsappRouter.post('/api/leads/import', async (req: Request, res: Response) => {
  const { leads, channelPhoneId } = req.body;
  if (!leads || !Array.isArray(leads)) {
    return res.status(400).json({ error: 'Lista de leads é obrigatória e deve ser um array.' });
  }

  const activeChannel = channelPhoneId || 'default';
  
  try {
    const formattedLeads = leads.map(l => ({
      phone: l.phone.replace(/\D/g, ''),
      name: l.name || 'Lead',
      channel_phone_id: activeChannel,
      created_at: new Date().toISOString(),
      history: '[]',
      source: 'csv'
    }));

    await LeadState.importLeads(formattedLeads);
    
    // Processa imediatamente os leads pendentes importados
    processPendingLeads().catch(err => console.error('Erro ao processar leads pós-importação:', err));

    res.json({ success: true, count: formattedLeads.length });
  } catch (err: any) {
    console.error('Erro na importação de leads:', err);
    res.status(500).json({ error: err.message || 'Erro ao importar leads.' });
  }
});

// Processa novos leads em lote que estão no status 'pending'
export async function processPendingLeads() {
  try {
    const pendingLeads = await LeadState.getNextPendingLeads(10);
    if (pendingLeads.length === 0) return;

    console.log(`[PENDING WORKER] Processando ${pendingLeads.length} leads pendentes...`);

    for (const lead of pendingLeads) {
      try {
        const activeChannel = lead.channel_phone_id || 'default';
        
        // Ativa o lead antes de enviar a mensagem para evitar concorrência
        lead.status = 'active';
        lead.stage = 'SITUATION';
        await LeadState.saveLead(lead);

        const firstName = lead.name ? lead.name.split(' ')[0] : 'Lead';
        const activeTemplate = 'boas_vindas_perelli';
        
        console.log(`[PENDING WORKER] Enviando template de boas-vindas para ${lead.phone}...`);
        await sendTemplateMessage(activeChannel, lead.phone, activeTemplate, [firstName]);
        
        const initialMessage = `Olá ${firstName}! Sou o Perelli, consultor virtual da Perelli Corretora. Tudo bem?\n\nMe conta: você quer cotar um plano de saúde individual, familiar ou seria empresarial/CNPJ?`;
        await LeadState.addMessage(lead.phone, activeChannel, 'assistant', initialMessage);
        
        // Aguarda 2 segundos entre mensagens para evitar bloqueio na API
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (leadErr) {
        console.error(`❌ Erro ao processar lead pendente ${lead.phone}:`, leadErr);
      }
    }
  } catch (err) {
    console.error('Erro na rotina processPendingLeads:', err);
  }
}

// Verifica e dispara cadência de follow-ups (24h, 3d, 7d)
export async function checkAndTriggerFollowUps() {
  try {
    const leads = await LeadState.getAllLeads();
    const now = new Date();
    
    // Filtra leads ativos elegíveis para follow-up
    const activeLeads = leads.filter(l => 
      l.status === 'active' && 
      l.stage !== 'CONVERTED' && 
      l.stage !== 'LOST' && 
      !l.requires_intervention
    );

    for (const lead of activeLeads) {
      const lastMsg = lead.history[lead.history.length - 1];
      // Apenas se a última mensagem foi do bot/assistente (esperando usuário)
      if (!lastMsg || lastMsg.role !== 'assistant') {
        continue;
      }

      const updatedTime = lead.updated_at ? new Date(lead.updated_at) : new Date(lead.created_at || Date.now());
      const diffMs = now.getTime() - updatedTime.getTime();
      
      const oneDayMs = 24 * 60 * 60 * 1000;
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      const activeChannel = lead.channel_phone_id || 'default';
      const followUpLevel = lead.follow_up_level || 0;

      try {
        // Nível 3 (7 dias sem resposta) -> Mensagem final e move para LOST
        if (diffMs >= sevenDaysMs && followUpLevel < 3) {
          console.log(`[CRON FOLLOW-UP 7D] Enviando follow-up 3 para ${lead.phone}...`);
          const text = await generateFollowUpCadence(lead, 3);
          
          await LeadState.addMessage(lead.phone, activeChannel, 'assistant', text);
          await sendMessage(activeChannel, lead.phone, text);
          
          lead.follow_up_level = 3;
          lead.last_follow_up_at = now.toISOString();
          lead.stage = 'LOST';
          await LeadState.saveLead(lead);
        }
        // Nível 2 (3 dias sem resposta)
        else if (diffMs >= threeDaysMs && followUpLevel < 2) {
          console.log(`[CRON FOLLOW-UP 3D] Enviando follow-up 2 para ${lead.phone}...`);
          const text = await generateFollowUpCadence(lead, 2);
          
          await LeadState.addMessage(lead.phone, activeChannel, 'assistant', text);
          await sendMessage(activeChannel, lead.phone, text);
          
          lead.follow_up_level = 2;
          lead.last_follow_up_at = now.toISOString();
          await LeadState.saveLead(lead);
        }
        // Nível 1 (24 horas sem resposta)
        else if (diffMs >= oneDayMs && followUpLevel < 1) {
          console.log(`[CRON FOLLOW-UP 24H] Enviando follow-up 1 para ${lead.phone}...`);
          const text = await generateFollowUpCadence(lead, 1);
          
          await LeadState.addMessage(lead.phone, activeChannel, 'assistant', text);
          await sendMessage(activeChannel, lead.phone, text);
          
          lead.follow_up_level = 1;
          lead.last_follow_up_at = now.toISOString();
          await LeadState.saveLead(lead);
        }
      } catch (err) {
        console.error(`Erro ao disparar follow-up no lead ${lead.phone}:`, err);
      }
    }
  } catch (err) {
    console.error('Erro na varredura checkAndTriggerFollowUps:', err);
  }
}

// Configura agendadores em background pós-inicialização
setTimeout(async () => {
  console.log('⏰ [BOOT WORKER] Executando varreduras iniciais...');
  try {
    await checkAndTriggerFollowUps();
    await processPendingLeads();
  } catch (err) {
    console.error('Erro no boot worker:', err);
  }
}, 10000); // 10 segundos

// Executa verificação de background a cada 15 minutos
setInterval(async () => {
  console.log('⏰ [CRON WORKER] Executando rotinas de background...');
  try {
    await checkAndTriggerFollowUps();
    await processPendingLeads();
  } catch (err) {
    console.error('Erro no cron worker:', err);
  }
}, 15 * 60 * 1000); // 15 minutos

// Endpoints de Analytics e IA Inteligência Contínua
whatsappRouter.get('/api/analytics/metrics', async (req: Request, res: Response) => {
  try {
    const leads = await LeadState.getAllLeads();
    const totalLeads = leads.length;

    const respondedLeads = leads.filter(l => l.history.some(m => m.role === 'user')).length;
    const proposalsLeads = leads.filter(l => ['NEED_PAYOFF', 'MEETING_SCHEDULED', 'CONVERTED'].includes(l.stage)).length;
    const convertedLeads = leads.filter(l => l.stage === 'CONVERTED').length;
    const lostLeads = leads.filter(l => l.stage === 'LOST').length;

    const responseRate = totalLeads > 0 ? (respondedLeads / totalLeads) * 100 : 0;
    const proposalRate = totalLeads > 0 ? (proposalsLeads / totalLeads) * 100 : 0;
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

    const hourlyDistribution = Array(24).fill(0);
    leads.forEach(l => {
      if (l.created_at) {
        const hour = new Date(l.created_at).getHours();
        if (hour >= 0 && hour < 24) {
          hourlyDistribution[hour]++;
        }
      }
    });

    let totalResponseTimeMs = 0;
    let responseCount = 0;

    leads.forEach(l => {
      const history = l.history;
      for (let i = 1; i < history.length; i++) {
        const prev = history[i - 1];
        const curr = history[i];
        
        if (prev.role === 'assistant' && curr.role === 'user' && prev.timestamp && curr.timestamp) {
          const prevTime = new Date(prev.timestamp).getTime();
          const currTime = new Date(curr.timestamp).getTime();
          const diff = currTime - prevTime;
          if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
            totalResponseTimeMs += diff;
            responseCount++;
          }
        }
      }
    });

    const avgResponseTimeSec = responseCount > 0 ? Math.round((totalResponseTimeMs / responseCount) / 1000) : 0;

    res.json({
      totalLeads,
      respondedLeads,
      proposalsLeads,
      convertedLeads,
      lostLeads,
      responseRate: parseFloat(responseRate.toFixed(1)),
      proposalRate: parseFloat(proposalRate.toFixed(1)),
      conversionRate: parseFloat(conversionRate.toFixed(1)),
      avgResponseTimeSec,
      hourlyDistribution
    });
  } catch (error: any) {
    console.error('Erro ao calcular métricas de analytics:', error);
    res.status(500).json({ error: error.message || 'Erro ao carregar métricas' });
  }
});

whatsappRouter.get('/api/analytics/learnings', async (req: Request, res: Response) => {
  try {
    const learning = await LeadState.getLatestLearning();
    res.json(learning);
  } catch (error: any) {
    console.error('Erro ao buscar aprendizados:', error);
    res.status(500).json({ error: error.message || 'Erro ao carregar aprendizados' });
  }
});

whatsappRouter.post('/api/analytics/analyze', async (req: Request, res: Response) => {
  try {
    const leads = await LeadState.getAllLeads();
    const activeLeads = leads.filter(l => l.history.length > 0);
    
    if (activeLeads.length === 0) {
      return res.status(400).json({ error: 'Nenhum lead com histórico de mensagens disponível para análise.' });
    }

    const converted = activeLeads.filter(l => l.stage === 'CONVERTED').slice(0, 10);
    const lost = activeLeads.filter(l => l.stage === 'LOST').slice(0, 10);
    const others = activeLeads.filter(l => l.stage !== 'CONVERTED' && l.stage !== 'LOST').slice(0, 5);

    const selectedLeads = [...converted, ...lost, ...others];

    let leadsDataText = '';
    selectedLeads.forEach((l, index) => {
      leadsDataText += `\n--- LEAD #${index + 1}: ${l.name || 'Sem Nome'} (${l.phone}) ---\n`;
      leadsDataText += `Estágio Atual: ${l.stage}\n`;
      leadsDataText += `Tem CNPJ: ${l.has_cnpj || 'Não definido'}\n`;
      leadsDataText += `Plano Escolhido: ${l.current_plan || 'Nenhum'}\n`;
      leadsDataText += `Histórico de Conversa:\n`;
      l.history.forEach(m => {
        leadsDataText += `[${m.role === 'user' ? 'CLIENTE' : 'SDR PERELLI'}]: ${m.content}\n`;
      });
    });

    console.log(`[ANALYTICS IA] Analisando ${selectedLeads.length} leads com o Gemini...`);
    const insights = await generateAnalyticsInsights(leadsDataText);
    
    await LeadState.saveLearning(insights);

    res.json({ success: true, insights });
  } catch (error: any) {
    console.error('Erro ao processar análise contínua de IA:', error);
    res.status(500).json({ error: error.message || 'Erro ao processar análise da IA' });
  }
});

