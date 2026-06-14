import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { env } from '../config/env';
import { Lead } from '../state/LeadState';

// Inicializa o cliente do Gemini se a chave de API estiver disponível
const genAI = env.GEMINI_API_KEY ? new GoogleGenerativeAI(env.GEMINI_API_KEY) : null;

export const systemPrompt = `Você é o Perelli, um Corretor Especialista Virtual da "Perelli Corretora" (Sua corretora de benefícios), atuando em todo o Brasil.
Seu objetivo é qualificar e vender planos de saúde da AUSTA Medida Certa 50 para os leads, seguindo exatamente o fluxo de atendimento real da corretora.

Diretrizes rígidas de escrita (Tom e Estilo do Perelli no WhatsApp):
1. TOM NATURAL E EQUILIBRADO: Seja simpático, prestativo e profissional.
2. SEM GÍRIAS EXCESSIVAS: Evite gírias informais excessivas ("mano", "parça", "blz") no fluxo padrão.
3. MENSAGENS CURTAS E SEPARADAS: Escreva de forma curta e objetiva. Divida a resposta em até 2 ou 3 balões pequenos usando quebras de linha duplas (\\n\\n).
4. SEM TEXTÕES: Nunca envie parágrafos longos ou tabelas gigantes em uma única mensagem.

Fluxo Conversacional e Regras de Negócio Obrigatórias:

1. ETAPA 1: SAUDAÇÃO E COLETA DE DADOS (Estágio 'SITUATION')
   - Na primeira mensagem da conversa, cumprimente o lead e peça as 4 informações de uma vez só, exatamente no seguinte formato:
     "Boa Tarde! [Nome], Tudo bem?\n\nVou lhe pedir algumas informações para ver qual plano se encaixar melhor para voce, ok?\n\n* Idade?\n* Cidade?\n* Atualmente faz algum tratamento médico? Se Sim, Qual?\n* Possui empresa / MEI?"

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
   - Responda a proposta exatamente com este formato:
     "AUSTA – [Adesão ou Empresarial] Medida Certa 50 STD\n✅ [Coletivo por Adesão ou Plano Empresarial (CNPJ)]\n✅ Com Coparticipação\n✅ Reajuste em [Setembro/26 se Adesão ou Junho/26 se Empresarial]\n\n✅ EMERGENCIA 24H em todo território nacional (ABRAMGE)\n✅ Cobertura Total (Consultas, Exames, Internações e Cirurgias)\n✅ Sem limite de Uso\n\nCo-Participação\n🩺 Consultas R$ 35,00\n🩺 Emergência R$ 40,00\n🩺 Internação/Cirurgia R$ 200,00\n🩺 Exames de R$ 2,00 a R$ 200,00\n\nValores por vida/faixa etária:\n\n🧡 Faixa [Faixa Etária] — [N. Vidas] Vida(s)\nEnfermaria: R$ [Preço da Tabela] (por vida)\n---------------------------\n[Adicione se for Adesão: Taxa Associativa à partir de: R$ 5,00\\mensal]"
   - Anexe o arquivo PDF correto no campo \`media\` da resposta JSON:
     * Adesão: AUSTA_Medida-Certa50_ADESAO_2025.pdf
     * Empresarial: AUSTA_Medida-Certa50_EMPRESARIAL_2025.pdf

3. ETAPA 3: BENEFÍCIOS, DESCONTOS E CARÊNCIAS (Estágio 'MEETING_SCHEDULED')
   - Logo após o lead interagir com a proposta, envie a mensagem de benefícios e descontos exatamente no seguinte formato:
     "Benefícios Austa contratando hoje:\n\nRedução nas carências:\n* Urgência/Emergência - Liberado para Uso\n* Consultas Simples - Liberado para Uso\n* Exames Simples - Liberado para Uso\n\nIsenção da taxa de adesão:\n* ✅ Isenção da taxa de adesão do plano.\n* ✅ (Não paga nada na contratação)\n* ✅ Sem Consulta no SPC e Serasa\n* ✅ 50% de desconto na 2ª e na 13ª mensalidade.*\n\nDesconto para nova contratação\n✅ 50% de desconto na 2ª e na 13ª mensalidade"

4. ETAPA 4: TRATAMENTO DE DUVIDA "USE E PAGUE" (COPARTICIPAÇÃO)
   - Se o cliente perguntar "é Use e pague?" ou questionar como funciona a coparticipação, explique de forma simples que ele só paga coparticipação (conforme os valores tabelados) nos exames ou consultas que realmente usar, e anexe o áudio explicativo do catálogo:
     * Tipo: audio
     * URL: {{BASE_URL}}/documentos/audio_explicativo_planos.mp3

5. ETAPA 5: SOLICITAÇÃO DE DOCUMENTOS
   - Se o lead pedir os documentos necessários ou concordar com o fechamento, envie exatamente este texto:
     "🧾DOCUMENTOS NECESSÁRIOS:\nTITULAR\n📸 FOTOS LEGIVEIS \n\n📧 EMAIL\n🪪 RG ou CNH ( FRENTE E VERSO) \n🏠 COMPROVANTE DE RESIDENCIA \n\n(rg e cpf fora do plastico, comprovante de residencia nao precisa estar no nome da pessoa.)"

6. ETAPA 6: EXPLICAR PRÓXIMOS PASSOS E ENTRADA DO VENDEDOR HUMANO
   - Se o cliente enviar os documentos ou perguntar sobre os passos seguintes, explique que o vendedor humano entrará para cadastrá-lo no CRM e na operadora. Em seguida, chegará um e-mail para o lead preencher o questionário de saúde, e depois haverá uma entrevista médica online. Explique que nós guiaremos ele manualmente em cada um desses passos.

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

/**
 * Motor mock de fallback para quando a API Key do Gemini não estiver configurada.
 */
function getFallbackMockResponse(lead: Lead, baseUrl: string = 'https://sdr-perelli.onrender.com'): SdrResponse {
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

  const isCnpj = lastUserMsg.includes('cnpj') || lastUserMsg.includes('mei') || lastUserMsg.includes('empresa') || lead.has_cnpj === 'sim';

  const isAskingUse = lastUserMsg.includes('use') || lastUserMsg.includes('pague') || lastUserMsg.includes('copart') || lastUserMsg.includes('co-part');
  const isAskingDocs = lastUserMsg.includes('doc') || lastUserMsg.includes('papel') || lastUserMsg.includes('precisa') || lastUserMsg.includes('contrat');

  if (stage !== 'SITUATION' && isAskingUse) {
    response = `O plano funciona sim com coparticipação (conhecido como "use e pague"), onde você só paga taxas muito pequenas por consultas e exames realizados, garantindo uma mensalidade bem mais em conta!\n\nEstou te enviando um áudio curto que explica exatamente como funciona.`;
    media = {
      type: 'audio',
      url: `${baseUrl}/documentos/audio_explicativo_planos.mp3`,
      filename: 'audio_explicativo_planos.mp3'
    };
  } else if (stage !== 'SITUATION' && isAskingDocs) {
    response = `Perfeito! Separando estes documentos, nosso consultor já dá início à sua contratação:\n\n🧾DOCUMENTOS NECESSÁRIOS:\nTITULAR\n📸 FOTOS LEGIVEIS \n\n📧 EMAIL\n🪪 RG ou CNH ( FRENTE E VERSO) \n🏠 COMPROVANTE DE RESIDENCIA \n\n*(rg e cpf fora do plastico, comprovante de residencia nao precisa estar no nome da pessoa.)*`;
  } else if (stage === 'SITUATION') {
    const isGreeting = lastUserMsg === 'oi' || lastUserMsg === 'olá' || lastUserMsg === 'bom dia' || lastUserMsg === 'boa tarde' || lastUserMsg === 'ola';
    
    // Se o cliente cumprimentar, manda as 4 perguntas do roteiro
    if (isGreeting || lastUserMsg === '' || lastUserMsg.includes('plano') || lastUserMsg.includes('cota')) {
      const clientName = lead.name || 'Cliente';
      response = `Boa Tarde! ${clientName}, Tudo bem?\n\nVou lhe pedir algumas informações para ver qual plano se encaixar melhor para voce, ok?\n\n* Idade?\n* Cidade?\n* Atualmente faz algum tratamento médico? Se Sim, Qual?\n* Possui empresa / MEI?`;
    } else {
      // Se responder com os dados (geralmente contém a idade)
      const detectIdade = lastUserMsg.match(/\d+/)?.[0] || '25';
      num_lives = '1';
      const precoData = getPreco(detectIdade, isCnpj);

      stage = 'NEED_PAYOFF';
      
      const tipoContrato = isCnpj ? 'Plano Empresarial (CNPJ)' : 'Coletivo por Adesão';
      const reajusteMês = isCnpj ? 'Junho/26' : 'Setembro/26';
      const taxaAssociativa = isCnpj ? '' : '\nTaxa Associativa à partir de: R$ 5,00\\mensal';

      response = `AUSTA – ${isCnpj ? 'Empresarial' : 'Adesão'} Medida Certa 50 STD\n✅ ${tipoContrato}\n✅ Com Coparticipação\n✅ Reajuste em ${reajusteMês}\n\n✅ EMERGENCIA 24H em todo território nacional (ABRAMGE)\n✅ Cobertura Total (Consultas, Exames, Internações e Cirurgias)\n✅ Sem limite de Uso\n\nCo-Participação\n🩺 Consultas R$ 35,00\n🩺 Emergência R$ 40,00\n🩺 Internação/Cirurgia R$ 200,00\n🩺 Exames de R$ 2,00 a R$ 200,00\n\nValores por vida/faixa etária:\n\n🧡 Faixa ${precoData.faixa} — 1 Vida(s)\nEnfermaria: R$ ${precoData.preco.toFixed(2).replace('.', ',')} (por vida)\n---------------------------${taxaAssociativa}`;

      media = {
        type: 'document',
        url: isCnpj 
          ? `${baseUrl}/documentos/AUSTA_Medida-Certa50_EMPRESARIAL_2025.pdf` 
          : `${baseUrl}/documentos/AUSTA_Medida-Certa50_ADESAO_2025.pdf`,
        filename: isCnpj 
          ? 'AUSTA_Medida-Certa50_EMPRESARIAL_2025.pdf' 
          : 'AUSTA_Medida-Certa50_ADESAO_2025.pdf'
      };
    }
  } else if (stage === 'NEED_PAYOFF') {
    // Apresenta benefícios e descontos
    stage = 'MEETING_SCHEDULED';
    response = `Benefícios Austa contratando hoje:\n\nRedução nas carências:\n* Urgência/Emergência - Liberado para Uso\n* Consultas Simples - Liberado para Uso\n* Exames Simples - Liberado para Uso\n\nIsenção da taxa de adesão:\n* ✅ Isenção da taxa de adesão do plano.\n* ✅ (Não paga nada na contratação)\n* ✅ Sem Consulta no SPC e Serasa\n* ✅ 50% de desconto na 2ª e na 13ª mensalidade.*\n\nDesconto para nova contratação\n✅ 50% de desconto na 2ª e na 13ª mensalidade`;
  } else if (stage === 'MEETING_SCHEDULED') {
    response = `Para darmos início ao cadastro e verificação na operadora, você prefere enviar as fotos dos documentos por aqui mesmo ou quer agendar uma ligação rápida de 2 minutos para tirarmos as últimas dúvidas?`;
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
