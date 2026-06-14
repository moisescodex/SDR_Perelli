import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { env } from '../config/env';
import { Lead } from '../state/LeadState';

// Inicializa o cliente do Gemini se a chave de API estiver disponível
const genAI = env.GEMINI_API_KEY ? new GoogleGenerativeAI(env.GEMINI_API_KEY) : null;

export const systemPrompt = `Você é o Perelli, um Corretor Especialista Virtual da "Perelli Corretora" (Sua corretora de benefícios), atuando em todo o Brasil.
Seu objetivo é qualificar leads interessados em planos de saúde (Individual, Familiar, MEI ou Empresarial), utilizando a metodologia SPIN Selling refinada para o estilo de atendimento real da Perelli.

Diretrizes rígidas de escrita (Tom e Estilo do Perelli no WhatsApp - Profissional, Humano e Solícito):
1. TOM NATURAL E EQUILIBRADO: Seja simpático e prestativo. Use de forma muito esporádica e natural termos acolhedores, mantendo sempre o profissionalismo de um corretor experiente.
2. SEM GÍRIAS EXCESSIVAS: Evite gírias informais excessivas ("mano", "parça", "blz") no fluxo padrão. Use abreviações normais de WhatsApp apenas nos follow-ups se necessário.
3. MENSAGENS CURTAS E SEPARADAS: Escreva de forma curta e objetiva. Divida a resposta em até 2 ou 3 balões pequenos usando quebras de linha duplas (\\n\\n). Cada mensagem deve ter no máximo 15 a 20 palavras.
4. SEM TEXTÕES: Nunca envie parágrafos longos ou tabelas gigantes em uma única mensagem.
5. ADAPTAÇÃO POR LOCALIDADE E PRODUTO (AUSTA MEDIDA CERTA 50):
   - Identifique a localidade do lead (ex: DDD 17 é São José do Rio Preto/região; MG cidades como Frutal/Iturama; MS cidade Aparecida do Taboado).
   - Demonstre inteligência regional citando os hospitais e operadoras locais apropriados.
   - Para a área de cobertura do AUSTA (cerca de 100 cidades em SP, 11 em MG e 1 em MS), use as regras reais do produto **AUSTA Medida Certa 50**:
     * PREÇOS STD (Enfermaria, faixa 0 a 23 anos): R$ 130,69 (Empresarial/MEI) ou R$ 138,84 (Adesão).
     * Acomodação Apartamento (SR): R$ 196,02 (Empresarial, 0-23 anos) ou R$ 208,25 (Adesão, 0-23 anos).
     * Coparticipação: Consulta eletiva R$ 35; Consulta de emergência R$ 40; Exames/Terapias 50% limitados a R$ 200; Internação R$ 200 fixo; Tomografia/Ressonância R$ 200 fixo.
     * Elegibilidade Adesão (Entidades Benevix): Estudantes > 6 anos (CAEEPP, taxa R$ 11,50), Autônomos/Sem formalidade (CAVA, taxa R$ 5,00, aceita declaração simples), Profissionais Liberais (CAPLA, taxa R$ 10,00), Comerciários/Sócios (CAEB, taxa R$ 4,00).

Catálogo de Mídias e Arquivos Disponíveis (Use para enriquecer a conversa enviando no campo 'media' do JSON caso pertinente):
- **Vídeo de Apresentação (Institutional Video)**:
  * Descrição: Vídeo curto mostrando os diferenciais de consultoria da Perelli Corretora.
  * URL: https://perellicorretora.com.br/wp-content/uploads/2026/02/Grupo-1.webp
  * Type: video
- **Apresentação Institucional (PDF Document)**:
  * Descrição: PDF com a rede credenciada e serviços da corretora.
  * URL: https://perellicorretora.com.br/wp-content/uploads/2026/02/cropped-cropped-Grupo-1.webp
  * Type: document
  * Filename: Apresentacao_Perelli_Corretora.pdf
- **Áudio Explicativo (Institutional Audio)**:
  * Descrição: Mensagem de voz explicando os descontos e vantagens para MEI/CNPJ.
  * URL: https://perellicorretora.com.br/wp-content/uploads/2026/02/cropped-cropped-Grupo-1.webp
  * Type: audio

Regra de Mídia: Se o cliente solicitar tabelas de preços, rede credenciada, ou se você achar adequado apresentar a corretora em vídeo/áudio nas etapas de IMPLICATION ou NEED_PAYOFF, retorne o objeto correspondente no campo 'media'. Não envie mídia se não for pertinente.

Condução do Discovery no Estilo Perelli (SPIN Selling adaptado):
- SITUATION: Boas-vindas e identificação inicial. Pergunte a idade/idades das pessoas que farão o plano ("Poderia me informar para qual idade seria a cotação?").
- PROBLEM: Confirme a localidade e se já possui algum plano de saúde ativo ou se seria o primeiro.
- IMPLICATION (Explicação de Descontos e Regras): Pergunte se o lead tem CNPJ ou MEI ou se é formado/estudante/autônomo, explicando que conseguimos descontos especiais de até 35% por perfil empresarial/adesão ("Só pra finalizar... você tem CNPJ ou MEI? Conseguimos liberar até 35% de desconto").
- NEED_PAYOFF (Apresentação da Proposta): Apresente o plano recomendado para a região dele, valores médios (por exemplo, comente que temos planos a partir de R$ 130,69 no Empresarial ou R$ 138,84 no Adesão pela AUSTA na região). Envie arquivos/mídias pertinentes.
- MEETING_SCHEDULED: Sugira uma breve ligação/reunião rápida hoje ou amanhã para simular os valores exatos e detalhar carências.

Responda APENAS com um objeto JSON válido seguindo o esquema estruturado abaixo. Não inclua Markdown (\`\`\`json) no início ou fim.
As quebras de linha na resposta de texto devem usar \\n escapado no JSON.`;

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    stage: { 
      type: SchemaType.STRING, 
      description: "O estágio atual do funil: 'SITUATION', 'PROBLEM', 'IMPLICATION', 'NEED_PAYOFF', 'MEETING_SCHEDULED', 'CONVERTED' ou 'LOST'" 
    },
    response: { 
      type: SchemaType.STRING, 
      description: "O texto da mensagem a ser enviada ao lead no WhatsApp" 
    },
    has_cnpj: { 
      type: SchemaType.STRING, 
      description: "Indica se o lead possui CNPJ/MEI: 'sim', 'não' ou null se não souber" 
    },
    current_plan: { 
      type: SchemaType.STRING, 
      description: "Nome da operadora do plano de saúde atual, 'nenhum' ou null se não souber" 
    },
    num_lives: { 
      type: SchemaType.STRING, 
      description: "Quantidade de vidas/pessoas que entrarão no plano, ou null se não souber" 
    },
    preferred_hospitals: { 
      type: SchemaType.STRING, 
      description: "Hospitais ou laboratórios indicados como indispensáveis, ou null se não souber" 
    },
    media: {
      type: SchemaType.OBJECT,
      properties: {
        type: { type: SchemaType.STRING, description: "O tipo de mídia: 'image', 'document', 'audio' ou 'video'" },
        url: { type: SchemaType.STRING, description: "A URL do arquivo de mídia no catálogo para envio" },
        filename: { type: SchemaType.STRING, description: "Nome opcional do arquivo para envio de documentos (ex: 'Apresentacao.pdf')" }
      }
    }
  },
  required: ["stage", "response"]
};

export interface SdrResponse {
  stage: Lead['stage'];
  response: string;
  has_cnpj?: string | null;
  current_plan?: string | null;
  num_lives?: string | null;
  preferred_hospitals?: string | null;
  media?: {
    type: 'image' | 'document' | 'audio' | 'video';
    url: string;
    filename?: string;
  } | null;
}

export async function generateSdrResponse(lead: Lead): Promise<SdrResponse> {
  if (!genAI) {
    return getFallbackMockResponse(lead);
  }

  try {
    const trimmedHistory = lead.history.slice(-12);
    
    // Converte o histórico para o formato do Gemini SDK
    const contents = trimmedHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content || '' }]
    }));

    // Injeta informações e estado do banco de dados no prompt para melhor contextualização
    const databaseContext = `
[DADOS ATUAIS NO BANCO DE DADOS]
- Telefone: ${lead.phone}
- Nome: ${lead.name || 'Não fornecido'}
- Estágio Atual: ${lead.stage}
- Possui CNPJ: ${lead.has_cnpj || 'Não identificado'}
- Plano Atual: ${lead.current_plan || 'Não identificado'}
- Número de Vidas: ${lead.num_lives || 'Não identificado'}
- Hospitais Preferidos: ${lead.preferred_hospitals || 'Não identificado'}
- ID do Canal: ${lead.channel_phone_id || 'default'}
`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemPrompt + databaseContext,
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      } as any
    });

    const result = await model.generateContent({ contents });
    const content = result.response.text().trim();
    
    let jsonString = content;
    if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    }

    const parsed = JSON.parse(jsonString) as SdrResponse;
    
    // Sanitiza e atualiza o lead caso novos dados tenham sido mapeados no JSON
    if (parsed.has_cnpj !== undefined) lead.has_cnpj = parsed.has_cnpj;
    if (parsed.current_plan !== undefined) lead.current_plan = parsed.current_plan;
    if (parsed.num_lives !== undefined) lead.num_lives = parsed.num_lives;
    if (parsed.preferred_hospitals !== undefined) lead.preferred_hospitals = parsed.preferred_hospitals;

    return parsed;
  } catch (error) {
    console.error('❌ Erro ao gerar resposta do SDR (Gemini):', error);
    return getFallbackMockResponse(lead);
  }
}

export async function generateFollowUpCadence(lead: Lead, stageIndex: number): Promise<string> {
  if (!genAI) {
    return 'Opa, conseguimos continuar por aqui? Se preferir, podemos tirar suas dúvidas direto pelo Whats mesmo. O que acha?';
  }

  try {
    const trimmedHistory = lead.history.slice(-10);
    const contents = [
      ...trimmedHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model' as 'user' | 'model',
        parts: [{ text: msg.content || '' }]
      })),
      {
        role: 'user' as const,
        parts: [{ text: `Instrução do Sistema: O lead está sem responder. Este é o follow-up de nível ${stageIndex} que estamos enviando.
Seu objetivo é, de forma muito informal, natural e amigável (tom de WhatsApp no Brasil, usando gírias leves como "vc", "tá", "blz", "gnt"):
1. Perguntar se ele quer continuar com a cotação do plano de saúde/seguro ou se o dia está muito corrido.
2. Relembrar que a Perelli Corretora consegue comparar todas as operadoras para buscar economia de até 35% caso ele tenha CNPJ ou MEI.
3. Oferecer responder direto por texto aqui no WhatsApp para não tomar tempo.
4. Tentar obter uma resposta se quer continuar ou não, sem ser chato.

Regras rígidas:
- Limite de 18 palavras.
- Retorne APENAS o texto do follow-up, sem aspas extras, sem explicações.` }]
      }
    ];

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.8,
      }
    });

    const result = await model.generateContent({ contents });
    return result.response.text().trim();
  } catch (error) {
    console.error(`❌ Erro ao gerar follow-up (etapa ${stageIndex}) com Gemini:`, error);
    return 'Tudo bem por aí? Se a rotina tiver corrida, me avisa se prefere receber a cotação direto por texto aqui.';
  }
}

export async function generateFollowUp(lead: Lead): Promise<string> {
  return generateFollowUpCadence(lead, 4);
}

export async function generateThreeHourFollowUp(lead: Lead): Promise<string> {
  return generateFollowUpCadence(lead, 1);
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  if (!genAI) {
    return '[Áudio recebido, mas o motor de IA local está sem chaves. Mock de transcrição: Olá, quero um plano de saúde]';
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const audioPart = {
      inlineData: {
        data: audioBuffer.toString('base64'),
        mimeType: mimeType
      }
    };
    const prompt = 'Transcreva este áudio do WhatsApp em português brasileiro de forma exata, sem adicionar nenhum comentário, introdução ou explicação. Apenas o texto falado.';
    const result = await model.generateContent([prompt, audioPart]);
    return result.response.text().trim();
  } catch (error) {
    console.error('❌ Erro ao transcrever áudio com Gemini:', error);
    throw error;
  }
}

export async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  if (!genAI) {
    return '[PDF recebido. Resumo mock: Arquivo contém dados pessoais do lead e cotação anterior]';
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const pdfPart = {
      inlineData: {
        data: pdfBuffer.toString('base64'),
        mimeType: 'application/pdf'
      }
    };
    const prompt = 'Leia este documento PDF e extraia as informações mais importantes e o texto principal em formato resumido, para que o SDR saiba do que se trata. Retorne apenas o resumo em português de forma clara.';
    const result = await model.generateContent([prompt, pdfPart]);
    return result.response.text().trim();
  } catch (error) {
    console.error('❌ Erro ao extrair texto do PDF com Gemini:', error);
    throw error;
  }
}

export function getRegionFromPhone(phone: string): { city: string, state: string, ddd: string } {
  const cleanPhone = phone.replace(/\D/g, '');
  let ddd = '';
  if (cleanPhone.startsWith('55') && cleanPhone.length >= 4) {
    ddd = cleanPhone.substring(2, 4);
  } else if (cleanPhone.length >= 2) {
    ddd = cleanPhone.substring(0, 2);
  }

  const dddMap: { [key: string]: { city: string, state: string } } = {
    // Pará
    '91': { city: 'Belém', state: 'PA' },
    '93': { city: 'Santarém', state: 'PA' },
    '94': { city: 'Marabá', state: 'PA' },
    // Rio de Janeiro
    '21': { city: 'Rio de Janeiro', state: 'RJ' },
    '22': { city: 'Campos dos Goytacazes', state: 'RJ' },
    '24': { city: 'Petrópolis', state: 'RJ' },
    // São Paulo
    '11': { city: 'São Paulo', state: 'SP' },
    '12': { city: 'São José dos Campos', state: 'SP' },
    '13': { city: 'Santos', state: 'SP' },
    '14': { city: 'Bauru', state: 'SP' },
    '15': { city: 'Sorocaba', state: 'SP' },
    '16': { city: 'Ribeirão Preto', state: 'SP' },
    '17': { city: 'São José do Rio Preto', state: 'SP' },
    '18': { city: 'Presidente Prudente', state: 'SP' },
    '19': { city: 'Campinas', state: 'SP' },
    // Minas Gerais
    '31': { city: 'Belo Horizonte', state: 'MG' },
    '32': { city: 'Juiz de Fora', state: 'MG' },
    '34': { city: 'Uberlândia', state: 'MG' },
    '35': { city: 'Poços de Caldas', state: 'MG' },
  };

  const mapped = dddMap[ddd];
  return mapped ? { ...mapped, ddd } : { city: 'São José do Rio Preto', state: 'SP', ddd };
}

/**
 * Motor mock de fallback para quando a API Key do Gemini não estiver configurada.
 */
function getFallbackMockResponse(lead: Lead): SdrResponse {
  const lastUserMsg = lead.history.filter(m => m.role === 'user').pop()?.content?.toLowerCase() || '';
  let stage = lead.stage;
  let response = '';

  let has_cnpj = lead.has_cnpj;
  let current_plan = lead.current_plan;
  let num_lives = lead.num_lives;
  let preferred_hospitals = lead.preferred_hospitals;
  let media: SdrResponse['media'] = null;

  // Detecta a localidade baseado no histórico de mensagens do usuário ou no DDD
  let region = getRegionFromPhone(lead.phone);
  const userMessagesText = lead.history
    .filter(m => m.role === 'user')
    .map(m => m.content.toLowerCase())
    .join(' ');

  if (userMessagesText.includes('rio preto') || userMessagesText.includes('são josé') || userMessagesText.includes('sjrp')) {
    region = { city: 'São José do Rio Preto', state: 'SP', ddd: '17' };
  } else if (userMessagesText.includes('rio de janeiro') || userMessagesText.includes('rj') || (userMessagesText.includes('rio') && !userMessagesText.includes('preto'))) {
    region = { city: 'Rio de Janeiro', state: 'RJ', ddd: '21' };
  } else if (userMessagesText.includes('são paulo') || userMessagesText.includes('sao paulo') || userMessagesText.includes('sp')) {
    region = { city: 'São Paulo', state: 'SP', ddd: '11' };
  }

  // Define os dados específicos por região
  const isRJ = region.state === 'RJ';
  const isSP = region.state === 'SP' && region.ddd !== '17';
  const isRioPreto = region.ddd === '17';
  const isPA = region.state === 'PA';

  const hospitalList = isRJ ? "Barra D'Or ou Samaritano" : isRioPreto ? "Hospital Austa ou Unimed" : isSP ? "Albert Einstein ou Sírio-Libanês" : "Porto Dias ou Beneficente Portuguesa";
  const operadorasList = isRJ ? "Bradesco Saúde, SulAmérica ou Amil" : isRioPreto ? "Austa Clínicas, BenSaúde ou Unimed" : isSP ? "Bradesco, SulAmérica ou Amil" : "Porto Dias Saúde ou Hapvida";

  if (stage === 'SITUATION') {
    const isGreeting = lastUserMsg === 'oi' || lastUserMsg === 'olá' || lastUserMsg === 'bom dia' || lastUserMsg === 'boa tarde' || lastUserMsg === 'ola';
    const hasAges = /\d+/.test(lastUserMsg);

    if (isGreeting || lastUserMsg === '') {
      response = `Olá! Sou o Perelli, corretor virtual da Perelli Corretora. Vi seu interesse em uma de nossas campanhas.\n\nPodemos nos falar por aqui?`;
    } else if (lastUserMsg.includes('sim') || lastUserMsg.includes('pode') || lastUserMsg.includes('ok') || lastUserMsg.includes('com certeza') || lastUserMsg.includes('bom dia')) {
      response = `Perfeito!\n\nPoderia me informar para qual idade seria a cotação?`;
    } else if (hasAges) {
      num_lives = lastUserMsg.match(/\d+/)?.[0] || '1';
      stage = 'PROBLEM';
      response = `Show!\n\nE seria para ${region.city} mesmo?`;
    } else {
      response = `Certo! Poderia me informar para qual idade seria a cotação?`;
    }
  } else if (stage === 'PROBLEM') {
    stage = 'IMPLICATION';
    response = `Beleza!\n\nAtualmente você já possui algum plano de saúde ativo ou seria a primeira contratação?`;
  } else if (stage === 'IMPLICATION') {
    current_plan = lastUserMsg.includes('unimed') ? 'Unimed' : lastUserMsg.includes('austa') ? 'Austa Clínicas' : lastUserMsg.includes('bensaude') ? 'BenSaúde' : lastUserMsg.includes('não') || lastUserMsg.includes('nao') || lastUserMsg.includes('primeira') ? 'nenhum' : 'Outro';
    stage = 'NEED_PAYOFF';
    response = `Perfeito!\n\nSó pra finalizar... com o que você trabalha? Se tem CNPJ ou MEI...\n\nPergunto porque se tiver CNPJ ou dependendo da formação, conseguimos liberar tabelas especiais com até 35% de desconto. Com o que trabalha?`;
  } else if (stage === 'NEED_PAYOFF') {
    has_cnpj = lastUserMsg.includes('cnpj') || lastUserMsg.includes('mei') || lastUserMsg.includes('empreendedor') || lastUserMsg.includes('empresa') || lastUserMsg.includes('autónom') || lastUserMsg.includes('autonom') ? 'sim' : 'não';
    stage = 'MEETING_SCHEDULED';

    if (isRioPreto) {
      response = `Consegui liberar a tabela recomendada para São José do Rio Preto.\n\nO plano **AUSTA Medida Certa 50** fica a partir de **R$ 130,69** com CNPJ/MEI ou **R$ 138,84** por Adesão (para estudantes ou autônomos).\n\nA rede de atendimento é maravilhosa. Estou te mandando o PDF da apresentação para você dar uma olhada.\n\nO que achou desses valores?`;
      media = {
        type: 'document',
        url: 'https://perellicorretora.com.br/wp-content/uploads/2026/02/cropped-cropped-Grupo-1.webp',
        filename: 'Apresentacao_Perelli_Corretora.pdf'
      };
    } else if (isRJ) {
      response = `Consegui liberar a tabela recomendada para o Rio de Janeiro.\n\nO plano **Amil S80** fica a partir de **R$ 422,20** com MEI.\n\nA rede cobre o Hospital Samaritano e Barra D'Or.\n\nO que achou do valor?`;
    } else {
      response = `Consegui liberar a tabela recomendada de planos de saúde para você.\n\nConseguimos opções excelentes cobrindo ${hospitalList} com excelente custo-benefício.\n\nO que achou?`;
    }
  } else if (stage === 'MEETING_SCHEDULED') {
    const isAgree = lastUserMsg.includes('gostei') || lastUserMsg.includes('bom') || lastUserMsg.includes('legal') || lastUserMsg.includes('valores') || lastUserMsg.includes('mandar') || lastUserMsg.includes('certo') || lastUserMsg.includes('sim') || lastUserMsg.includes('preferencia') || lastUserMsg.includes('preferência');
    
    if (isAgree) {
      response = `Excelente!\n\nPra gente detalhar carências e fechar a melhor opção para você, nosso corretor pode te ligar por 5 minutinhos hoje às 14h ou prefere às 16h?`;
    } else {
      response = `Combinado! Deixei agendado. Em instantes o nosso especialista entra em contato com o estudo completo no WhatsApp. Tmj!`;
    }
  }

  return {
    stage,
    response,
    has_cnpj,
    current_plan,
    num_lives,
    preferred_hospitals,
    media
  };
}
