import { generateSdrResponse, SdrResponse } from './ai/openai';
import { Lead } from './state/LeadState';

async function testDocumentFlow() {
  console.log('🧪 Iniciando Teste de Validação de Documentos do SDR...\n');

  // Lead no estágio MEETING_SCHEDULED (pronto para enviar os documentos)
  const lead: Lead = {
    phone: '5591999999999',
    channel_phone_id: 'default',
    name: 'Roberto',
    stage: 'MEETING_SCHEDULED',
    status: 'active',
    history: [
      { role: 'user', content: 'Quais documentos precisa para a contratação?' },
      { role: 'assistant', content: 'Perfeito! Para darmos início à contratação, preciso que envie por aqui fotos bem legíveis dos seguintes documentos:\n\n🧾 DOCUMENTOS NECESSÁRIOS:\nTITULAR\n📸 FOTOS LEGIVEIS \n\n📧 EMAIL\n🪪 RG ou CNH (FRENTE E VERSO) \n🏠 COMPROVANTE DE RESIDENCIA' }
    ],
    has_cnpj: 'sim',
    current_plan: 'nenhum',
    num_lives: '49',
    preferred_hospitals: 'São José do Rio Preto',
    document_status: null
  };

  // 1. Simular o envio de um RG
  console.log('--- Cenário 1: Lead envia o RG ---');
  const analysis1 = {
    detectedType: 'rg' as const,
    isReadable: true,
    isDocument: true,
    feedback: 'RG legível e válido.'
  };

  let docStatus = { rg_cnh: { type: 'rg', valid: true, feedback: analysis1.feedback }, residence: null as any };
  lead.document_status = JSON.stringify(docStatus);
  const rgMessageText = `[Imagem enviada - Tipo: ${analysis1.detectedType}, Legível: ${analysis1.isReadable}, É Documento: ${analysis1.isDocument}, Feedback: ${analysis1.feedback}]`;
  lead.history.push({ role: 'user', content: rgMessageText });
  console.log(`👤 Lead envia mídia (Simulação): "${rgMessageText}"`);

  let sdrResponse: SdrResponse = await generateSdrResponse(lead);
  lead.history.push({ role: 'assistant', content: sdrResponse.response });
  console.log(`🤖 Bot Responde (Estágio: ${sdrResponse.stage}):`);
  console.log(sdrResponse.response);
  console.log('Document Status:', lead.document_status);
  console.log('--------------------------------------------------\n');

  // 2. Simular o envio de um comprovante inválido/ilegível
  console.log('--- Cenário 2: Lead envia comprovante ilegível ---');
  const analysis2 = {
    detectedType: 'comprovante_residencia' as const,
    isReadable: false,
    isDocument: true,
    feedback: 'Comprovante com imagem muito escura e dados do endereço cortados.'
  };

  docStatus.residence = { type: 'comprovante_residencia', valid: false, feedback: analysis2.feedback };
  lead.document_status = JSON.stringify(docStatus);
  const badResMessageText = `[Imagem enviada - Tipo: ${analysis2.detectedType}, Legível: ${analysis2.isReadable}, É Documento: ${analysis2.isDocument}, Feedback: ${analysis2.feedback}]`;
  lead.history.push({ role: 'user', content: badResMessageText });
  console.log(`👤 Lead envia mídia (Simulação): "${badResMessageText}"`);

  sdrResponse = await generateSdrResponse(lead);
  lead.history.push({ role: 'assistant', content: sdrResponse.response });
  console.log(`🤖 Bot Responde (Estágio: ${sdrResponse.stage}):`);
  console.log(sdrResponse.response);
  console.log('Document Status:', lead.document_status);
  console.log('--------------------------------------------------\n');

  // 3. Simular o envio de um comprovante válido
  console.log('--- Cenário 3: Lead corrige e envia comprovante válido ---');
  const analysis3 = {
    detectedType: 'comprovante_residencia' as const,
    isReadable: true,
    isDocument: true,
    feedback: 'Comprovante de residência legível e válido.'
  };

  docStatus.residence = { type: 'comprovante_residencia', valid: true, feedback: analysis3.feedback };
  lead.document_status = JSON.stringify(docStatus);
  const goodResMessageText = `[Imagem enviada - Tipo: ${analysis3.detectedType}, Legível: ${analysis3.isReadable}, É Documento: ${analysis3.isDocument}, Feedback: ${analysis3.feedback}]`;
  lead.history.push({ role: 'user', content: goodResMessageText });
  console.log(`👤 Lead envia mídia (Simulação): "${goodResMessageText}"`);

  sdrResponse = await generateSdrResponse(lead);
  lead.history.push({ role: 'assistant', content: sdrResponse.response });
  console.log(`🤖 Bot Responde (Estágio: ${sdrResponse.stage}):`);
  console.log(sdrResponse.response);
  console.log('Document Status:', lead.document_status);
  console.log('--------------------------------------------------\n');
}

testDocumentFlow();
