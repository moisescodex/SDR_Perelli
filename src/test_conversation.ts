import { generateSdrResponse, SdrResponse } from './ai/openai';
import { Lead, Message } from './state/LeadState';

async function simulateConversation() {
  console.log('🧪 Iniciando Simulação de Conversa Local com o SDR Perelli...\n');

  // Inicializa o lead mockado
  const lead: Lead = {
    phone: '5591999999999',
    channel_phone_id: 'default',
    name: 'Roberto',
    stage: 'SITUATION',
    status: 'active',
    history: [],
    has_cnpj: null,
    current_plan: null,
    num_lives: null,
    preferred_hospitals: null
  };

  // Turnos da conversa a simular
  const userMessages = [
    'Oi, bom dia! Gostaria de cotar um plano de saúde.',
    'Tenho 49 anos, moro em São José do Rio Preto, não faço nenhum tratamento e sou MEI.',
    'Gostei da proposta. Mas esse plano é Use e pague?',
    'Quais documentos precisa para a contratação?'
  ];

  for (let i = 0; i < userMessages.length; i++) {
    const userMsg = userMessages[i];
    console.log(`👤 USUÁRIO: "${userMsg}"`);

    // Adiciona a mensagem do usuário ao histórico do lead
    lead.history.push({ role: 'user', content: userMsg });

    // Gera a resposta do SDR
    const result: SdrResponse = await generateSdrResponse(lead);
    
    // Atualiza o lead com o resultado gerado
    lead.stage = result.stage;
    lead.history.push({ role: 'assistant', content: result.response, media: result.media });
    
    if (result.has_cnpj !== undefined) lead.has_cnpj = result.has_cnpj;
    if (result.current_plan !== undefined) lead.current_plan = result.current_plan;
    if (result.num_lives !== undefined) lead.num_lives = result.num_lives;
    if (result.preferred_hospitals !== undefined) lead.preferred_hospitals = result.preferred_hospitals;

    console.log(`🤖 PERELLI (Estágio: ${lead.stage}):`);
    console.log(result.response.replace(/\\n/g, '\n'));
    if (result.media) {
      console.log(`📎 Mídia anexada: [${result.media.type}] URL: ${result.media.url}`);
    }
    console.log('\n[DADOS EXTRAÍDOS NO CRM]:', {
      has_cnpj: lead.has_cnpj,
      current_plan: lead.current_plan,
      num_lives: lead.num_lives,
      preferred_hospitals: lead.preferred_hospitals
    });
    console.log('--------------------------------------------------\n');
    
    // Pequena pausa para simular digitação
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('🎉 Simulação concluída com sucesso!');
}

simulateConversation();
