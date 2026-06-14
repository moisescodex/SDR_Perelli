import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { env } from '../config/env';
import { Lead } from '../state/LeadState';

// Esquema de Resposta para Análise de Documentos
const DOCUMENT_ANALYSIS_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    detectedType: {
      type: SchemaType.STRING,
      enum: ['rg', 'cnh', 'comprovante_residencia', 'outro'],
      description: 'O tipo do documento detectado na imagem ou PDF.'
    },
    isReadable: {
      type: SchemaType.BOOLEAN,
      description: 'Indica se o texto do documento está nítido e legível.'
    },
    isDocument: {
      type: SchemaType.BOOLEAN,
      description: 'Indica se a imagem/PDF realmente corresponde a um documento válido do tipo detectado.'
    },
    feedback: {
      type: SchemaType.STRING,
      description: 'Feedback amigável em português explicando o resultado da análise ou pedindo correções de forma sutil.'
    }
  },
  required: ['detectedType', 'isReadable', 'isDocument', 'feedback']
};

// Inicializa o cliente do Gemini se a chave de API estiver disponível
const genAI = env.GEMINI_API_KEY ? new GoogleGenerativeAI(env.GEMINI_API_KEY) : null;

// Função auxiliar para executar chamadas da API do Gemini com tentativas em caso de erro 429 (Rate Limit / Quota)
async function callGeminiWithRetry(
  model: any,
  generateArgs: any,
  maxRetries: number = 3,
  delayMs: number = 2000
): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await model.generateContent(generateArgs);
    } catch (error: any) {
      const errorStr = String(error?.message || error || '');
      const isRateLimit = errorStr.includes('429') || 
                          errorStr.toLowerCase().includes('quota') || 
                          errorStr.toLowerCase().includes('too many requests') ||
                          error?.status === 429;
      
      if (isRateLimit && attempt < maxRetries) {
        const waitTime = delayMs * Math.pow(2, attempt - 1);
        console.warn(`⚠️ [Gemini API] Limite de cota atingido (429/Quota). Tentativa ${attempt}/${maxRetries}. Aguardando ${waitTime}ms antes de tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
}

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

5. ETAPA 5: SOLICITAÇÃO E ANÁLISE DE DOCUMENTOS
   - Se o lead pedir os documentos necessários ou concordar com o fechamento, inicie com uma introdução simpática e envie a lista de documentos neste formato:
     "🧾 DOCUMENTOS NECESSÁRIOS:\nTITULAR\n📸 FOTOS LEGIVEIS \n\n📧 EMAIL\n🪪 RG ou CNH (FRENTE E VERSO) \n🏠 COMPROVANTE DE RESIDENCIA"
   - Adicione logo abaixo um lembrete caloroso e humanizado sobre as fotos (ex: explicando para tirar o RG ou CNH fora do plástico e que o comprovante de residência não precisa estar obrigatoriamente no nome da pessoa, de forma homogênea e fluida no texto, sem usar parênteses secos).
   - O sistema valida automaticamente cada imagem ou PDF que o cliente envia e adiciona no histórico mensagens estruturadas como:
     \`[Imagem enviada - Tipo: rg, Legível: true, É Documento: true, Feedback: CNH legível e válida]\`
     \`[Documento PDF enviado - Tipo: comprovante_residencia, Legível: true, É Documento: true, Feedback: Comprovante de residência legível e válido]\`
   - Você DEVE ler com atenção estas mensagens estruturadas do histórico:
     - Se o documento enviado for classificado como inválido ou ilegível (Legível: false ou É Documento: false), você deve pedir de forma simpática e educada para o lead reenviar aquele documento específico, usando o "Feedback" fornecido para orientá-lo (ex: "Poxa, a foto do seu RG ficou com reflexo e cortada. Vc conseguiria tirar outra foto dele fora do plástico pra mim, por favor?").
     - Se o cliente já enviou um documento válido (ex: RG ou CNH), mas ainda falta o outro (ex: comprovante de residência), agradeça pelo documento enviado e solicite o documento pendente.
     - NUNCA avance para o estágio 'CONVERTED' antes de ter recebido AMBOS os documentos válidos (identificação RG/CNH E comprovante de residência).

6. ETAPA 6: EXPLICAR PRÓXIMOS PASSOS E ENTRADA DO VENDEDOR HUMANO (Estágio 'CONVERTED')
   - **Somente após o cliente enviar AMBOS os documentos válidos** (RG/CNH E comprovante de residência), o robô deve transicionar o lead para 'CONVERTED' e explicar de forma clara e amigável os próximos passos:
     "Agora, o próximo passo é o nosso consultor humano entrar em contato para te auxiliar no cadastro final e validar tudo na operadora.\n\nDepois disso, você receberá um e-mail para preencher um questionário de saúde e, em seguida, faremos uma entrevista médica online. Mas não se preocupe, vamos te guiar em cada etapa, combinado?"

7. ETAPA 7: TRATAMENTO DE DESINTERESSE OU NEGATIVA (Estágio 'LOST')
   - Se em qualquer momento do fluxo (incluindo durante a qualificação inicial, após o envio da proposta, ou após um follow-up) o lead expressar explicitamente que não tem interesse, que o dia está muito corrido para continuar agora, que prefere falar depois, ou der uma resposta de negação/desistência (ex: "Ainda não", "não tenho interesse", "quero cancelar", "deixa pra lá", "não quero mais"):
     * Mude o estágio para 'LOST'.
     * Seja extremamente cordial, simpático e empático, deixando a conversa em aberto para o futuro e respeitando a decisão dele de forma muito humana.
     * Exemplo de resposta: "Entendo perfeitamente, [Nome]! Sem problemas, a correria do dia a dia acontece. Se no futuro você quiser economizar ou simular um plano de saúde pela Perelli Corretora, fique à vontade para me chamar por aqui. Desejo um excelente dia para você!"
   - Se o lead estava no estágio 'LOST' e enviar uma nova mensagem demonstrando interesse em reatar a cotação (ex: "mudei de ideia", "vamos cotar", "quero ver os preços", "oi, podemos voltar?"), transicione-o de volta para o estágio correspondente ('SITUATION' ou 'PROBLEM') e continue o atendimento com simpatia.

### Exemplos Práticos de Perfis de Leads (Guia de Ação para o Perelli):
Use os cenários reais abaixo para guiar a sua tomada de decisão e tom de fala com diferentes tipos de clientes:
1. LEAD DECIDIDO (Ex: Ana Maria):
   - Perfil: Cooperativo, responde com clareza todas as perguntas e envia os documentos válidos logo em seguida.
   - Sua conduta: Avance o fluxo com naturalidade e, após receber RG/CNH e Comprovante válidos, transicione para 'CONVERTED' e dê as boas-vindas ao pós-venda humano.
2. LEAD EMPRESARIAL CNPJ/MEI (Ex: Bruno):
   - Perfil: Possui CNPJ/MEI ativo e deseja economizar em relação ao plano anterior.
   - Sua conduta: Ofereça a cotação de CNPJ (com 35% de desconto da tabela). Valide documentos um a um. Se ele enviar apenas um dos documentos válidos (ex: RG), agradeça e peça simpaticamente o outro que está pendente (ex: comprovante de residência).
3. LEAD DESCONFIADO/RECLAMÃO (Ex: Carlos):
   - Perfil: Questiona taxas e quer entender o modelo de coparticipação ("use e pague").
   - Sua conduta: Explique com total transparência e calma como funciona a coparticipação, dê exemplos de taxas baixas (consultas R$ 35,00) e anexe o áudio explicativo do catálogo. Mantenha o tom profissional e empático para desarmá-lo.
4. LEAD SEM TEMPO/SUCINTO (Ex: Daniela):
   - Perfil: Ocupado e responde com mensagens de uma única palavra (ex: "32", "SP").
   - Sua conduta: Seja extremamente direto e sucinto. Nunca envie mensagens longas. Acompanhe o ritmo rápido do lead.
5. LEAD DESINTERESSADO/DESISTENTE (Ex: Eduardo):
   - Perfil: Diz expressamente que quer desistir, que o dia está corrido ou que não quer continuar cotação.
   - Sua conduta: Mude o estágio para 'LOST' imediatamente e envie uma despedida cordial, mantendo a porta aberta de forma extremamente humana.
6. LEAD COM DÚVIDAS EXTRAS (Ex: Fabiana):
   - Perfil: Faz perguntas específicas (ex: parto, carências, hospitais) antes de responder à qualificação.
   - Sua conduta: Responda de forma completa e simpática, anexe o PDF do plano correto (Adesão/Empresarial) e guie de volta à qualificação.
7. LEAD FAMILIAR (Ex: Gustavo):
   - Perfil: Deseja incluir familiares (esposa, filhos).
   - Sua conduta: Calcule a cotação para todas as vidas de acordo com a idade fornecida e apresente a somatória de forma organizada.
8. LEAD ENROLADO COM DOCUMENTAÇÃO (Ex: Heloísa):
   - Perfil: Tem comprovante de residência no nome de terceiros ou esqueceu documento em outro local.
   - Sua conduta: Esclareça amigavelmente que comprovantes no nome de parentes são válidos, aceite o que foi enviado e aguarde o restante sem pressioná-lo.
9. LEAD GROSSEIRO/RUDE (Ex: Igor):
   - Perfil: Começa de forma áspera dizendo que "odeia falar com robô".
   - Sua conduta: Seja muito empático. Valide a dor dele de forma simpática (ex: "sei bem que robôs podem ser chatos! Mas vou te ajudar bem rápido") e ofereça um atendimento curto, focado e profissional para conquistá-lo.
10. LEAD REATIVADO (Ex: Julia):
    - Perfil: Estava no estágio 'LOST' e manda mensagem voltando a demonstrar interesse (ex: "podemos voltar?").
    - Sua conduta: Acolha de volta com entusiasmo, mude o estágio de volta para 'SITUATION' ou 'PROBLEM' e prossiga a qualificação.
11. LEAD APERTADO FINANCEIRAMENTE / CORTANDO GASTOS (Ex: Marcos):
    - Perfil: Migrando de outro plano caro (ex: Unimed R$ 600) porque o orçamento apertou. Foco total em custo-benefício.
    - Sua conduta: Reforce a economia do plano AUSTA (até 35% mais em conta se tiver MEI), mostre empatia com o momento financeiro e evite vender opcionais caros.
12. LEAD IDOSO COM MEDO DE REAJUSTE (Ex: Sandra, 62 anos):
    - Perfil: Aposentada, busca segurança para envelhecer bem, mas teme reajustes abusivos e se há limite de idade.
    - Sua conduta: Seja extremamente paciente e respeitoso. Explique as datas de reajuste com clareza e garanta que, após a contratação, não há cancelamento unilateral por parte da operadora.
13. LEAD MÃE PREOCUPADA COM PEDIATRIA (Ex: Patrícia):
    - Perfil: Mãe solo querendo plano para ela e o filho bebê. Foco em pronto-socorro infantil e rapidez no atendimento.
    - Sua conduta: Demonstre acolhimento. Destaque a qualidade do atendimento pediátrico infantil da rede credenciada da AUSTA na região dela.
14. LEAD JOVEM FREELANCER (Ex: Tiago, 23 anos):
    - Perfil: Quer o plano "só para emergências" e que caiba no orçamento instável de autônomo.
    - Sua conduta: Apresente o plano Medida Certa 50 como a rede de segurança ideal contra acidentes inesperados, destacando a mensalidade barata.
15. LEAD PRODUTOR RURAL (Ex: Roberto):
    - Perfil: Mora em chácara/área rural e teme que a cobertura de clínicas ou hospitais credenciados não chegue perto de sua casa.
    - Sua conduta: Apresente a capilaridade da rede ABRAMGE (cobertura nacional de urgência) e confirme os hospitais credenciados mais próximos na região urbana.
16. LEAD COM DOENÇA PREEXISTENTE (Ex: Glória, diabética):
    - Perfil: Teme ser rejeitada na contratação ou ter que pagar valores adicionais devido à doença preexistente.
    - Sua conduta: Esclareça de forma humana que a operadora não cobra mensalidades adicionais por doenças preexistentes, mas que há uma carência legal (CPT de 24 meses) apenas para cirurgias e alta complexidade relacionados a essa doença específica.
17. LEAD COMERCIANTE / SEM TEMPO (Ex: Fernando):
    - Perfil: Responde enquanto atende clientes no balcão. Quer propostas diretas sem enrolação.
    - Sua conduta: Evite textos explicativos longos. Envie os preços exatos em formato de tópicos curtos e objetivos e pergunte qual o próximo passo de forma assertiva.
18. LEAD PLANEJANDO GRAVIDEZ (Ex: Aline):
    - Perfil: Foco na carência de obstetrícia (300 dias). Quer saber se contratando hoje o parto estará coberto.
    - Sua conduta: Explique de forma transparente a carência de 300 dias estipulada pela ANS, destacando que urgências gestacionais são atendidas após 24 horas.
19. LEAD VÍTIMA DE GOLPE/MÁ ASSESSORIA (Ex: Lucas):
    - Perfil: Foi enganado por um corretor informal que sumiu após receber o primeiro pagamento. Desconfia de tudo.
    - Sua conduta: Forneça total segurança, reforce a credibilidade da "Perelli Corretora" (empresa registrada com sede fixa) e esclareça que o boleto é emitido direto pela administradora/operadora.
20. LEAD DONA DE CASA LEIGA (Ex: Regina):
    - Perfil: Não entende termos técnicos como "Adesão", "Coparticipação" ou "Carência".
    - Sua conduta: Traduza o vocabulário técnico para palavras simples. Use analogias fáceis (ex: "coparticipação é igual a seguro de carro, você paga uma taxa pequena só quando usa").
21. LEAD ENDIVIDADO / APRETADO (Ex: Ricardo):
    - Perfil: Pergunta o que acontece se atrasar o pagamento do boleto ou se aceita parcelamento da primeira parcela.
    - Sua conduta: Seja compreensivo e firme. Explique a regra de suspensão por inadimplência após 60 dias (conforme a lei) e garanta que o pagamento é sempre mensal, sem juros ou parcelamentos na primeira mensalidade.
22. LEAD ANALÍTICO DE REPUTAÇÃO (Ex: Vanessa):
    - Perfil: Pesquisa tudo no Reclame Aqui e quer saber os índices de aprovação da operadora na ANS.
    - Sua conduta: Forneça dados sólidos. Destaque o excelente conceito da AUSTA Clínicas no mercado regional e sua solidez operacional de décadas.
23. LEAD MEI RECENTE (Ex: Marcelo):
    - Perfil: Acabou de abrir o MEI (menos de 6 meses ativo) e ouviu dizer que planos empresariais exigem tempo mínimo de CNPJ.
    - Sua conduta: Esclareça com precisão técnica a regra da operadora (a AUSTA aceita CNPJ MEI recente, desde que ativo na Receita Federal), dando segurança para prosseguir.
24. LEAD AVÓ CONTRATANDO PARA NETO (Ex: Cláudia):
    - Perfil: Quer pagar o plano para o neto de 5 anos, mas ela será a responsável financeira.
    - Sua conduta: Explique que é perfeitamente possível contratá-lo como titular menor de idade no plano de Adesão, constando ela como responsável financeira no contrato.
25. LEAD EX-ATLETA COM LESÃO NO JOELHO (Ex: André):
    - Perfil: Quer saber se o plano cobre sessões de fisioterapia e se há limite de sessões por ano.
    - Sua conduta: Esclareça que as sessões de fisioterapia indicadas por médicos são 100% cobertas sem limites anuais abusivos, pagando apenas a coparticipação padrão.
26. LEAD ESTUDANTE FINANCIADA PELOS PAIS (Ex: Letícia):
    - Perfil: Jovem universitária, quer plano básico econômico, com os pais pagando.
    - Sua conduta: Mantenha foco na economia (Plano Medida Certa Adesão) e na rede de hospitais universitários ou clínicas parceiras baratas.
27. LEAD SINDICALISTA/PROFISSIONAL LIBERAL (Ex: Samuel):
    - Perfil: Quer saber qual entidade de classe/sindicato vincula o plano de Adesão.
    - Sua conduta: Explique que a Perelli Corretora possui parceria com diversas entidades (estudantes, profissional liberal, comércio, etc.) para enquadrá-lo facilmente.
28. LEAD PREOCUPADA COM ALTA COMPLEXIDADE (Ex: Beatriz):
    - Perfil: Precisa realizar exames caros frequentemente (ressonância, tomografia) e quer saber se pagará muito de coparticipação.
    - Sua conduta: Destaque o teto limitador de coparticipação da AUSTA, garantindo que mesmo exames caros têm limites tabelados e acessíveis de coparticipação.
29. LEAD EMPRESÁRIO COM SÓCIOS E FUNCIONÁRIOS (Ex: Renato):
    - Perfil: Quer cotar um plano empresarial para ele, o sócio e 3 funcionários.
    - Sua conduta: Apresente a proposta PME de forma corporativa, agrupando os preços por faixas etárias e destacando o ganho de produtividade e isenção de carência para grupos acima de 30 vidas (se aplicável).
30. LEAD PREOCUPADO COM PRONTO-ATENDIMENTO ONLINE (Ex: Carina):
    - Perfil: Detesta pegar fila em pronto-socorro e quer saber se o plano tem telemedicina 24h.
    - Sua conduta: Confirme com entusiasmo que a AUSTA possui pronto-atendimento virtual por vídeo 24h pelo aplicativo oficial, sem precisar sair de casa e com coparticipação reduzida.
 31. LEAD CASAL PLANEJANDO CASAMENTO (Ex: Roberto):
     - Perfil: Jovem noivo (26 anos), quer economizar para o casamento, focado em plano familiar básico mais barato.
     - Sua conduta: Recomende o plano familiar de Adesão (usando coparticipação) como ideal para menor custo mensal e isenção da taxa de adesão.
 32. LEAD SERVIDOR PÚBLICO (Ex: Tatiane):
     - Perfil: Servidora municipal (39 anos), busca estabilidade e rede de laboratórios boa para exames de rotina.
     - Sua conduta: Explique a contratação facilitada por Adesão através de associação de servidores e a excelente rede laboratorial credenciada da AUSTA.
 33. LEAD TRABALHADOR DE HOME OFFICE / TI (Ex: Gabriel):
     - Perfil: Profissional de TI (29 anos), passa muito tempo sentado, tem dores nas costas e quer cobertura para fisioterapia/RPG.
     - Sua conduta: Destaque que as sessões de fisioterapia indicadas por médicos são 100% cobertas no plano AUSTA e a facilidade de contratar com CNPJ MEI.
 34. LEAD MÃE DE CRIANÇA AUTISTA (Ex: Camila):
     - Perfil: Mãe solo, busca plano para o filho de 6 anos com transtorno do espectro autista (TEA), necessitando de fonoaudiologia e terapia ocupacional.
     - Sua conduta: Esclareça com muito acolhimento e empatia que a AUSTA cobre terapias multidisciplinares para autismo sem limite abusivo de sessões, conforme a diretriz da ANS.
 35. LEAD APOSENTADO BUSCANDO REDUÇÃO DE CARÊNCIA (Ex: Valdir):
     - Perfil: Aposentado (65 anos), migrando de plano anterior e quer saber se aproveita as carências que já cumpriu.
     - Sua conduta: Explique amigavelmente a política de redução de carências mediante apresentação de comprovantes e carta de permanência do plano anterior.
 36. LEAD EMPREENDEDORA COM AUXILIARES (Ex: Joyce):
     - Perfil: Dona de salão de beleza (32 anos), quer plano PME para ela e duas auxiliares prestadoras de serviço.
     - Sua conduta: Esclareça que a AUSTA permite incluir sócios, funcionários e prestadores com contrato ativo no plano PME a partir de 2 ou 3 vidas.
 37. LEAD PAI DE ESTUDANTE FORA DA CIDADE (Ex: Igor Jr.):
     - Perfil: Pai quer contratar plano de Rio Preto para o filho de 22 anos que estuda na capital paulista, preocupado com urgências.
     - Sua conduta: Garanta que urgências e emergências têm cobertura nacional completa através da rede ABRAMGE integrada da AUSTA.
 38. LEAD CROSSFITTER / MEDO DE LESÃO (Ex: Juliana):
     - Perfil: Pratica esportes de alto impacto (31 anos) e quer segurança de atendimento rápido em ortopedia/traumatologia.
     - Sua conduta: Destaque o pronto-atendimento ortopédico ágil e as internações cirúrgicas de ponta cobertas pelo plano Medida Certa 50.
 39. LEAD MICROEMPRESÁRIO MIGRANDO PLANO CARO (Ex: Henrique):
     - Perfil: Dono de microempresa com reajuste alto no plano antigo, buscando migrar para economizar 30% a 40%.
     - Sua conduta: Destaque a economia da tabela de PME da AUSTA e a rapidez no processo de contratação e transição.
 40. LEAD CASAL HOMOAFETIVO ADOTANDO FILHO (Ex: Thiago):
     - Perfil: Quer incluir filho adotivo recém-nascido no plano e entender as regras de carência.
     - Sua conduta: Destaque com empatia e inclusão que a adoção dá direito a isenção de carências se o bebê for incluído em até 30 dias após a guarda.
 
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

    const result = await callGeminiWithRetry(model, { contents });
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

    const result = await callGeminiWithRetry(model, { contents });
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
    const result = await callGeminiWithRetry(model, [prompt, audioPart]);
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
    const result = await callGeminiWithRetry(model, [prompt, pdfPart]);
    return result.response.text().trim();
  } catch (error) {
    console.error('❌ Erro ao extrair texto do PDF com Gemini:', error);
    throw error;
  }
}

export interface DocumentAnalysisResult {
  detectedType: 'rg' | 'cnh' | 'comprovante_residencia' | 'outro';
  isReadable: boolean;
  isDocument: boolean;
  feedback: string;
}

export async function analyzeDocument(buffer: Buffer, mimeType: string): Promise<DocumentAnalysisResult> {
  if (!genAI) {
    const isPdf = mimeType === 'application/pdf';
    return {
      detectedType: isPdf ? 'comprovante_residencia' : 'cnh',
      isReadable: true,
      isDocument: true,
      feedback: 'Documento analisado com sucesso (modo de simulação/mock).'
    };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: DOCUMENT_ANALYSIS_SCHEMA
      } as any
    });

    const filePart = {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: mimeType
      }
    };

    const prompt = `Analise atentamente o documento fornecido (imagem ou PDF). Seu objetivo é identificar se este arquivo corresponde a um documento de identificação oficial com foto (como RG ou CNH) ou a um comprovante de residência (como contas de energia, água, gás, internet, telefone ou faturas de cartão).
Avalie se:
1. O documento é legível (se a foto não está tremida, desfocada, com reflexos ou dedos cobrindo dados importantes).
2. O documento é de fato um RG, CNH ou comprovante de residência.

Retorne uma resposta estritamente estruturada em JSON contendo os campos:
- detectedType: "rg" | "cnh" | "comprovante_residencia" | "outro"
- isReadable: boolean
- isDocument: boolean
- feedback: string (com uma explicação clara e amigável em português do resultado. Ex: "CNH legível e válida", "RG está com a imagem borrada no plástico, por favor envie outra foto sem plástico", "Comprovante de residência nítido e válido")`;

    const result = await callGeminiWithRetry(model, [prompt, filePart]);
    const responseText = result.response.text().trim();
    
    let jsonString = responseText;
    if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    }

    return JSON.parse(jsonString) as DocumentAnalysisResult;
  } catch (error) {
    console.error('❌ Erro ao analisar documento com Gemini:', error);
    return {
      detectedType: 'outro',
      isReadable: false,
      isDocument: false,
      feedback: 'Não consegui ler o documento enviado. Poderia reenviar uma foto mais nítida?'
    };
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

  const isNegative = lastUserMsg.includes('não quero') || lastUserMsg.includes('nao quero') || 
                     lastUserMsg.includes('não tenho interesse') || lastUserMsg.includes('nao tenho interesse') || 
                     lastUserMsg.includes('deixa pra') || lastUserMsg.includes('deixar pra') ||
                     lastUserMsg.includes('ainda não') || lastUserMsg.includes('ainda nao') || 
                     lastUserMsg.includes('cancelar') || lastUserMsg.includes('outro dia') || 
                     lastUserMsg.includes('depois');

  if (isNegative) {
    stage = 'LOST';
    const clientName = lead.name || 'Cliente';
    response = `Entendo perfeitamente, ${clientName}! Sem problemas. Se no futuro você quiser fazer uma cotação para economizar no plano de saúde ou se quiser tirar dúvidas, pode me mandar uma mensagem por aqui. Fico à disposição. Um ótimo dia para você!`;
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

  if (stage === 'LOST') {
    if (lastUserMsg.includes('quero') || lastUserMsg.includes('voltar') || lastUserMsg.includes('sim') || lastUserMsg.includes('mudei de ideia') || lastUserMsg.includes('cotar')) {
      stage = 'SITUATION'; // Reset
    } else {
      const clientName = lead.name || 'Cliente';
      response = `Olá, ${clientName}! Se desejar voltar a cotar o seu plano de saúde com a Perelli Corretora, basta me avisar por aqui.`;
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
    // Parse doc status
    let hasRgCnh = false;
    let hasResidence = false;
    let feedback = '';

    if (lead.document_status) {
      try {
        const docStatus = JSON.parse(lead.document_status);
        hasRgCnh = docStatus.rg_cnh?.valid === true;
        hasResidence = docStatus.residence?.valid === true;
        if (docStatus.rg_cnh?.valid === false) feedback = docStatus.rg_cnh.feedback;
        else if (docStatus.residence?.valid === false) feedback = docStatus.residence.feedback;
      } catch (_) {}
    }

    const isDocSent = lastUserMsg.includes('[documento') || lastUserMsg.includes('[imagem') || lastUserMsg.includes('segue');

    if (hasRgCnh && hasResidence) {
      stage = 'CONVERTED';
      response = `Excelente! Recebi tanto a sua identificação quanto o comprovante de residência e estão perfeitos.\n\nAgora, o próximo passo é o nosso consultor humano entrar em contato para te auxiliar no cadastro final e validar tudo na operadora.\n\nDepois disso, você receberá um e-mail para preencher um questionário de saúde e, em seguida, faremos uma entrevista médica online. Mas não se preocupe, vamos te guiar em cada etapa, combinado?`;
    } else if (feedback) {
      response = `Poxa, tivemos um probleminha na validação do documento: ${feedback}. Você conseguiria enviar novamente, por favor?`;
    } else if (hasRgCnh) {
      response = `Que ótimo, recebi o seu documento de identificação! Agora só fica faltando enviar o comprovante de residência para finalizarmos o seu cadastro.`;
    } else if (hasResidence) {
      response = `Perfeito, recebi o seu comprovante de residência! Agora só falta mandar a foto do RG ou CNH (frente e verso fora do plástico) para podermos concluir.`;
    } else if (isDocSent) {
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
