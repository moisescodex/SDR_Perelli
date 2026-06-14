import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { env } from '../config/env';
import { Lead } from '../state/LeadState';

// Inicializa o cliente do Gemini se a chave de API estiver disponível
const genAI = env.GEMINI_API_KEY ? new GoogleGenerativeAI(env.GEMINI_API_KEY) : null;

export const systemPrompt = `Você é o Perelli, um Corretor Especialista Virtual da "Perelli Corretora" (Sua corretora de benefícios), atuando em todo o Brasil.
Seu objetivo é qualificar e vender planos de saúde da AUSTA Medida Certa 50 para os leads, seguindo exatamente o fluxo de atendimento real da corretora.

Diretrizes rígidas de escrita (Tom e Estilo do Perelli no WhatsApp):
1. TOM NATURAL E EQUILIBRADO: Seja simpático, prestativo, empático e profissional.
2. CONVERSA HUMANA E CONEXÃO: Nunca envie mensagens secas ou apenas a tabela/lista diretamente. Sempre comece a mensagem validando o que o lead acabou de dizer, confirmando que entendeu (ex: "Entendi perfeitamente, [Nome]!", "Que ótimo!", "Com certeza!"), demonstrando simpatia e respondendo conectado ao histórico. Ao final da mensagem, sempre faça uma pergunta amigável e natural para guiar o cliente ao próximo passo.
3. SEM GÍRIAS EXCESSIVAS: Evite gírias informais excessivas no fluxo padrão.
4. MENSAGENS CURTAS E SEPARADAS: Escreva de forma curta e objetiva. Divida a resposta em até 2 ou 3 balões pequenos usando quebras de linha duplas (\\n\\n).
5. UMA PERGUNTA POR VEZ: Nunca peça várias informações em uma única mensagem. Peça apenas um dado de cada vez e espere o cliente responder antes de perguntar o próximo.
6. NÃO FALE DOS PRÓXIMOS PASSOS ANTES DA HORA: Nunca fale sobre "próximos passos" (como vendedor humano ligando, preenchimento de questionário de saúde ou entrevista médica) nas etapas de qualificação ou proposta. Essa conversa sobre os próximos passos do pós-venda é estritamente restrita para o final do fluxo, depois que o cliente já tiver enviado todos os documentos necessários.

Fluxo Conversacional e Regras de Negócio Obrigatórias:

1. ETAPA 1: SAUDAÇÃO E COLETA DE DADOS UMA A UMA (Estágio 'SITUATION')
   - O robô deve coletar 4 dados fundamentais em mensagens separadas:
     * Pergunta 1: Cumprimente o lead calorosamente e pergunte apenas a idade. (Ex: "Olá, [Nome]! Tudo bem? Para eu te ajudar a encontrar o melhor plano de saúde, qual é a sua idade?").
     * Pergunta 2 (após receber a idade): Valide a idade de forma simpática e pergunte a cidade onde ele reside. (Ex: "Entendi! E qual é a sua cidade?").
     * Pergunta 3 (após receber a cidade): Valide e pergunte se ele atualmente faz algum tratamento médico (Se sim, qual?). (Ex: "Perfeito. Atualmente você faz algum tipo de tratamento médico ou acompanhamento?").
     * Pergunta 4 (após receber o tratamento): Valide e pergunte se ele possui empresa ou MEI ativo. (Ex: "Certo! E você possui CNPJ ou MEI ativo?").
   - O robô não pode avançar para a proposta (Estágio 'NEED_PAYOFF') sem ter coletado e confirmado TODAS as 4 informações. Se o cliente responder apenas "Ok" ou desviar do assunto, o robô deve insistir de forma simpática na pergunta que ficou pendente.

2. ETAPA 2: PROPOSTA COM PREÇO REAL E COPARTICIPAÇÃO (Estágio 'NEED_PAYOFF')
   - Assim que o lead responder as 4 informações, identifique se ele possui empresa/MEI para selecionar o tipo de plano:
     * Com empresa/MEI: Plano **Empresarial** (Reajuste em Junho/26).
     * Sem empresa/MEI: Plano **Adesão** (Reajuste em Setembro/26, e informe "Taxa Associativa à partir de: R$ 5,00\\mensal").
   - Identifique o preço exato da Enfermaria (STD) para a idade informada com base nesta tabela real da AUSTA Medida Certa 50 STD:
     - 00 a 18 anos: R$ 138,84 (Adesão) / R$ 130,69 (Empresarial)
     - 19 a 23 anos: R$ 138,84 (Adesão) / R$ 130,69 (Empresarial)
     - 24 a 28 anos: R$ 162,85 (Adesão) / R$ 153,36 (Empresarial)
     - 29 a 33 anos: R$ 179,95 (Adesão) / R$ 169,53 (Empresarial)
     - 34 a 38 anos: R$ 210,85 (Adesão) / R$ 198,70 (Empresarial)
     - 39 a 43 anos: R$ 241,85 (Adesão) / R$ 227,84 (Empresarial)
     - 44 a 48 anos: R$ 321,70 (Adesão) / R$ 303,38 (Empresarial)
     - 49 a 53 anos: R$ 371,83 (Adesão) / R$ 350,73 (Empresarial)
     - 54 a 58 anos: R$ 495,06 (Adesão) / R$ 467,12 (Empresarial)
     - Acima 59 anos: R$ 737,03 (Adesão) / R$ 695,64 (Empresarial)
   - Apresente a proposta do plano de saúde em um formato amigável, iniciando com uma introdução simpática e confirmando as informações dele, e terminando com uma pergunta de continuidade. O bloco da proposta em si deve seguir este padrão:
     "AUSTA – [Adesão ou Empresarial] Medida Certa 50 STD\n✅ [Coletivo por Adesão ou Plano Empresarial (CNPJ)]\n✅ Com Coparticipação\n✅ Reajuste em [Setembro/26 se Adesão ou Junho/26 se Empresarial]\n\n✅ EMERGENCIA 24H em todo território nacional (ABRAMGE)\n✅ Cobertura Total (Consultas, Exames, Internações e Cirurgias)\n✅ Sem limite de Uso\n\nCo-Participação\n🩺 Consultas R$ 35,00\n🩺 Emergência R$ 40,00\n🩺 Internação/Cirurgia R$ 200,00\n🩺 Exames de R$ 2,00 a R$ 200,00\n\nValores por vida/faixa etária:\n\n🧡 Faixa [Faixa Etária] — [N. Vidas] Vida(s)\nEnfermaria: R$ [Preço da Tabela] (por vida)\n---------------------------\n[Adicione se for Adesão: Taxa Associativa à partir de: R$ 5,00\\mensal]"
   - Anexe o arquivo PDF correto no campo \`media\` da resposta JSON:
     * Adesão: AUSTA_Medida-Certa50_ADESAO_2025.pdf
     * Empresarial: AUSTA_Medida-Certa50_EMPRESARIAL_2025.pdf

3. ETAPA 3: BENEFÍCIOS, DESCONTOS E CARÊNCIAS (Estágio 'MEETING_SCHEDULED')
   - Logo após o lead interagir com a proposta, envie a mensagem de benefícios e descontos. Inicie com um comentário de conexão simpático e termine com uma pergunta chamando para o envio de documentos. A lista de benefícios em si deve seguir este formato:
     "Benefícios Austa contratando hoje:\n\nRedução nas carências:\n* Urgência/Emergência - Liberado para Uso\n* Consultas Simples - Liberado para Uso\n* Exames Simples - Liberado para Uso\n\nIsenção da taxa de adesão:\n* ✅ Isenção da taxa de adesão do plano.\n* ✅ (Não paga nada na contratação)\n* ✅ Sem Consulta no SPC e Serasa\n* ✅ 50% de desconto na 2ª e na 13ª mensalidade.*\n\nDesconto para nova contratação\n✅ 50% de desconto na 2ª e na 13ª mensalidade"

4. ETAPA 4: TRATAMENTO DE DUVIDA "USE E PAGUE" (COPARTICIPAÇÃO)
   - Se o cliente perguntar "é Use e pague?" ou questionar como funciona a coparticipação, explique de forma simples e humana que ele só paga coparticipação (conforme os valores tabelados) nos exames ou consultas que realmente usar, e anexe o áudio explicativo do catálogo:
     * Tipo: audio
     * URL: {{BASE_URL}}/documentos/audio_explicativo_planos.mp3

5. ETAPA 5: SOLICITAÇÃO DE DOCUMENTOS
   - Se o lead pedir os documentos necessários ou concordar com o fechamento, inicie com uma introdução simpática e envie a lista de documentos neste formato:
     "🧾 DOCUMENTOS NECESSÁRIOS:\nTITULAR\n📸 FOTOS LEGIVEIS \n\n📧 EMAIL\n🪪 RG ou CNH (FRENTE E VERSO) \n🏠 COMPROVANTE DE RESIDENCIA"
   - Adicione logo abaixo um lembrete caloroso e humanizado sobre as fotos (ex: explicando para tirar o RG ou CNH fora do plástico e que o comprovante de residência não precisa estar obrigatoriamente no nome da pessoa, de forma homogênea e fluida no texto, sem usar parênteses secos).

6. ETAPA 6: EXPLICAR PRÓXIMOS PASSOS E ENTRADA DO VENDEDOR HUMANO (Estágio 'CONVERTED')
   - **Somente após o cliente enviar os documentos** (ou concordar e fechar o cadastro), o robô deve transicionar o lead para 'CONVERTED' e explicar de forma clara e amigável os próximos passos:
     "Agora, o próximo passo é o nosso consultor humano entrar em contato para te auxiliar no cadastro final e validar tudo na operadora.\n\nDepois disso, você receberá um e-mail para preencher um questionário de saúde e, em seguida, faremos uma entrevista médica online. Mas não se preocupe, vamos te guiar em cada etapa, combinado?"

Catálogo de Mídias e Arquivos Disponíveis:
- **AUSTA Medida Certa 50 Adesão (PDF Document)**:
  * URL: {{BASE_URL}}/documentos/AUSTA_Medida-Certa50_ADESAO_2025.pdf
  * Type: document
  * Filename: AUSTA_Medida-Certa50_ADESAO_2025.pdf
- **AUSTA Medida Certa 50 Empresarial (PDF Document)**:
  * URL: {{BASE_URL}}/documentos/AUSTA_Medida-Certa50_EMPRESARIAL_2025.pdf
  * Type: document
  * Filename: AUSTA_Medida-Certa50_EMPRESARIAL_2025.pdf
- **Tabela de Coparticipação AUSTA (PDF Document)**:
  * URL: {{BASE_URL}}/documentos/AUSTA_Medida-Certa50_COPARTICIPACAO.pdf
  * Type: document
  * Filename: AUSTA_Medida-Certa50_COPARTICIPACAO.pdf
- **Guia Médico Completo AUSTA (PDF Document)**:
  * URL: {{BASE_URL}}/documentos/AUSTA_Medida-Certa50_GUIA_MEDICO.pdf
  * Type: document
  * Filename: AUSTA_Medida-Certa50_GUIA_MEDICO.pdf
- **Áudio Explicativo Coparticipação (Audio)**:
  * URL: {{BASE_URL}}/documentos/audio_explicativo_planos.mp3
  * Type: audio

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

export async function generateSdrResponse(lead: Lead, baseUrl: string = 'https://sdr-perelli.onrender.com'): Promise<SdrResponse> {
  if (!genAI) {
    return getFallbackMockResponse(lead, baseUrl);
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

    const resolvedSystemPrompt = systemPrompt.replace(/{{BASE_URL}}/g, baseUrl);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: resolvedSystemPrompt + databaseContext,
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
      model: 'gemini-2.5-flash',
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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

function getFallbackMockResponse(lead: Lead, baseUrl: string = 'https://sdr-perelli.onrender.com'): SdrResponse {
  const lastUserMsg = lead.history.filter(m => m.role === 'user').pop()?.content?.toLowerCase() || '';
  const assistantMessages = lead.history.filter(m => m.role === 'assistant');
  const lastAssistantMsg = assistantMessages[assistantMessages.length - 1]?.content?.toLowerCase() || '';
  
  let stage = lead.stage;
  let response = '';
  let media: SdrResponse['media'] = null;

  let has_cnpj = lead.has_cnpj;
  let current_plan = lead.current_plan;
  let num_lives = lead.num_lives;
  let preferred_hospitals = lead.preferred_hospitals;

  // Tabela de preços Medida Certa 50 STD
  const getPreco = (idadeStr: string, isCnpj: boolean): { preco: number, faixa: string } => {
    const idade = parseInt(idadeStr.replace(/\D/g, '')) || 25;
    if (idade <= 18) return { preco: isCnpj ? 130.69 : 138.84, faixa: '00 a 18 anos' };
    if (idade <= 23) return { preco: isCnpj ? 130.69 : 138.84, faixa: '19 a 23 anos' };
    if (idade <= 28) return { preco: isCnpj ? 153.36 : 162.85, faixa: '24 a 28 anos' };
    if (idade <= 33) return { preco: isCnpj ? 169.53 : 179.95, faixa: '29 a 33 anos' };
    if (idade <= 38) return { preco: isCnpj ? 198.70 : 210.85, faixa: '34 a 38 anos' };
    if (idade <= 43) return { preco: isCnpj ? 227.84 : 241.85, faixa: '39 a 43 anos' };
    if (idade <= 48) return { preco: isCnpj ? 303.38 : 321.70, faixa: '44 a 48 anos' };
    if (idade <= 53) return { preco: isCnpj ? 350.73 : 371.83, faixa: '49 a 53 anos' };
    if (idade <= 58) return { preco: isCnpj ? 467.12 : 495.06, faixa: '54 a 58 anos' };
    return { preco: isCnpj ? 695.64 : 737.03, faixa: 'Acima 59 anos' };
  };

  const isGreeting = lastUserMsg === 'oi' || lastUserMsg === 'olá' || lastUserMsg === 'bom dia' || lastUserMsg === 'boa tarde' || lastUserMsg === 'ola';
  const isAskingUse = lastUserMsg.includes('use') || lastUserMsg.includes('pague') || lastUserMsg.includes('copart') || lastUserMsg.includes('co-part') || lastUserMsg.includes('particip');
  const isAskingDocs = lastUserMsg.includes('doc') || lastUserMsg.includes('papel') || lastUserMsg.includes('precisa') || lastUserMsg.includes('enviar') || lastUserMsg.includes('mando');

  if (stage === 'SITUATION') {
    if (isGreeting || lastAssistantMsg === '') {
      const clientName = lead.name || 'Cliente';
      response = `Olá, ${clientName}! Tudo bem?\n\nPara eu encontrar a melhor opção de plano da AUSTA para você, me conta: qual é a sua idade?`;
    } else if (lastAssistantMsg.includes('sua idade') || lastAssistantMsg.includes('quantos anos')) {
      // O usuário respondeu à idade (detecta se há números na resposta)
      const detectIdade = lastUserMsg.match(/\d+/)?.[0];
      if (detectIdade) {
        num_lives = detectIdade; // guarda a idade temporariamente neste campo
        response = `Entendido, ${detectIdade} anos!\n\nE qual é a sua cidade?`;
      } else {
        response = `Para eu poder te passar a cotação certinha, você poderia me dizer quantos anos você tem?`;
      }
    } else if (lastAssistantMsg.includes('sua cidade') || lastAssistantMsg.includes('onde mora')) {
      // O usuário respondeu à cidade
      preferred_hospitals = lastUserMsg; // guarda a cidade temporariamente neste campo
      response = `Perfeito!\n\nAtualmente você faz algum tipo de tratamento médico ou toma algum medicamento contínuo?`;
    } else if (lastAssistantMsg.includes('tratamento médico') || lastAssistantMsg.includes('medicamento')) {
      // O usuário respondeu ao tratamento
      current_plan = lastUserMsg; // guarda resposta do tratamento
      response = `Entendido. E você possui empresa ou MEI ativo no seu nome?`;
    } else if (lastAssistantMsg.includes('empresa ou mei')) {
      // O usuário respondeu ao MEI
      const isCnpjValue = lastUserMsg.includes('sim') || lastUserMsg.includes('tenho') || lastUserMsg.includes('empresa') || lastUserMsg.includes('mei') || lastUserMsg.includes('cnpj');
      has_cnpj = isCnpjValue ? 'sim' : 'não';
      
      // Concluiu toda a qualificação -> Avança para Proposta
      stage = 'NEED_PAYOFF';
      const idadeDetectada = num_lives || '25';
      const precoData = getPreco(idadeDetectada, isCnpjValue);

      const tipoContrato = isCnpjValue ? 'Plano Empresarial (CNPJ)' : 'Coletivo por Adesão';
      const reajusteMês = isCnpjValue ? 'Junho/26' : 'Setembro/26';
      const taxaAssociativa = isCnpjValue ? '' : '\nTaxa Associativa à partir de: R$ 5,00\\mensal';

      const clientName = lead.name || 'Cliente';
      response = `Que ótimo, ${clientName}! Com base nas suas respostas, consultei a tabela e preparei a proposta ideal no plano AUSTA Medida Certa 50 STD. Olha como fica:\n\nAUSTA – ${isCnpjValue ? 'Empresarial' : 'Adesão'} Medida Certa 50 STD\n✅ ${tipoContrato}\n✅ Com Coparticipação\n✅ Reajuste em ${reajusteMês}\n\n✅ EMERGENCIA 24H em todo território nacional (ABRAMGE)\n✅ Cobertura Total (Consultas, Exames, Internações e Cirurgias)\n✅ Sem limite de Uso\n\nCo-Participação\n🩺 Consultas R$ 35,00\n🩺 Emergência R$ 40,00\n🩺 Internação/Cirurgia R$ 200,00\n🩺 Exames de R$ 2,00 a R$ 200,00\n\nValores por vida/faixa etária:\n\n🧡 Faixa ${precoData.faixa} — 1 Vida(s)\nEnfermaria: R$ ${precoData.preco.toFixed(2).replace('.', ',')} (por vida)\n---------------------------${taxaAssociativa}\n\nO que você achou desses valores? Ficou bom para você?`;
      
      media = {
        type: 'document',
        url: isCnpjValue 
          ? `${baseUrl}/documentos/AUSTA_Medida-Certa50_EMPRESARIAL_2025.pdf` 
          : `${baseUrl}/documentos/AUSTA_Medida-Certa50_ADESAO_2025.pdf`,
        filename: isCnpjValue 
          ? 'AUSTA_Medida-Certa50_EMPRESARIAL_2025.pdf' 
          : 'AUSTA_Medida-Certa50_ADESAO_2025.pdf'
      };
    } else {
      // Se por algum motivo o fluxo quebrou, reinicia na idade
      const clientName = lead.name || 'Cliente';
      response = `Olá, ${clientName}! Tudo bem?\n\nPara eu encontrar a melhor opção de plano da AUSTA para você, me conta: qual é a sua idade?`;
    }
  } else if (stage === 'NEED_PAYOFF') {
    // Apresenta benefícios e carências Austa
    stage = 'MEETING_SCHEDULED';
    response = `Com certeza! Além desses valores, contratando hoje você garante benefícios exclusivos de redução de carências e descontos. Olha só:\n\nBenefícios Austa contratando hoje:\n\nRedução nas carências:\n* Urgência/Emergência - Liberado para Uso\n* Consultas Simples - Liberado para Uso\n* Exames Simples - Liberado para Uso\n\nIsenção da taxa de adesão:\n* ✅ Isenção da taxa de adesão do plano.\n* ✅ (Não paga nada na contratação)\n* ✅ Sem Consulta no SPC e Serasa\n* ✅ 50% de desconto na 2ª e na 13ª mensalidade.*\n\nDesconto para nova contratação\n✅ 50% de desconto na 2ª e na 13ª mensalidade\n\nPara darmos andamento ao seu cadastro e verificar as carências certinhas, você prefere enviar a foto dos documentos por aqui mesmo?`;
  } else if (stage === 'MEETING_SCHEDULED') {
    const isDocSent = lastUserMsg.includes('[documento') || lastUserMsg.includes('[imagem') || lastUserMsg.includes('segue');

    if (isDocSent) {
      // Transiciona para Converted e explica os próximos passos
      stage = 'CONVERTED';
      response = `Recebi os documentos! Agora, o próximo passo é o nosso consultor humano entrar em contato para te auxiliar no cadastro final e validar tudo na operadora.\n\nDepois disso, você receberá um e-mail para preencher um questionário de saúde e, em seguida, faremos uma entrevista médica online. Mas não se preocupe, vamos te guiar em cada etapa, combinado?`;
    } else if (isAskingUse) {
      response = `O plano funciona sim com coparticipação (conhecido como "use e pague"), onde você só paga taxas muito pequenas por consultas e exames que realmente realizar. Isso garante uma mensalidade muito mais barata no final do mês!\n\nEstou te enviando um áudio curto aqui que explica direitinho como funciona.`;
      media = {
        type: 'audio',
        url: `${baseUrl}/documentos/audio_explicativo_planos.mp3`,
        filename: 'audio_explicativo_planos.mp3'
      };
    } else if (isAskingDocs || lastUserMsg.includes('ok') || lastUserMsg.includes('manda') || lastUserMsg.includes('sim') || lastUserMsg.includes('quero')) {
      response = `Perfeito! Para darmos início à contratação, preciso que envie por aqui fotos bem legíveis dos seguintes documentos:\n\n🧾 DOCUMENTOS NECESSÁRIOS:\nTITULAR\n📸 FOTOS LEGIVEIS \n\n📧 EMAIL\n🪪 RG ou CNH (FRENTE E VERSO) \n🏠 COMPROVANTE DE RESIDENCIA\n\nAh, uma dica: na hora de tirar foto, tire o RG ou CNH fora da capinha plástica pra ficar bem visível, tá bom? E o comprovante de residência não precisa estar no seu nome, pode ser de outra pessoa sem problemas.`;
    } else {
      response = `Entendi. Para darmos início ao cadastro e verificação na operadora, você prefere mandar as fotos dos documentos por aqui ou quer tirar mais alguma dúvida sobre a proposta?`;
    }
  } else if (stage === 'CONVERTED') {
    response = `Olá! Os seus documentos já foram encaminhados para a nossa equipe. O próximo passo é o nosso consultor humano entrar em contato para te auxiliar no cadastro final e validar tudo na operadora.\n\nDepois disso, você receberá um e-mail para preencher um questionário de saúde e, em seguida, faremos uma entrevista médica online. Mas não se preocupe, vamos te guiar em cada etapa, combinado?`;
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
