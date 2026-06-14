import { generateSdrResponse, SdrResponse } from './ai/openai';
import { Lead } from './state/LeadState';

async function testLostFlow() {
  console.log('🧪 Iniciando Teste de Negativa e Desinteresse (LOST Stage)...\n');

  const lead: Lead = {
    phone: '5591999999999',
    channel_phone_id: 'default',
    name: 'Victor',
    stage: 'SITUATION',
    status: 'active',
    history: [
      { role: 'user', content: 'Oi, gostaria de uma cotação.' },
      { role: 'assistant', content: 'Olá, Victor! Tudo bem?\n\nPara eu encontrar a melhor opção de plano da AUSTA para você, me conta: qual é a sua idade?' }
    ],
    has_cnpj: null,
    current_plan: null,
    num_lives: null,
    preferred_hospitals: null,
    document_status: null
  };

  // Turno 1: Usuário responde "Ainda não" ou "Não tenho interesse"
  console.log('--- Cenário: Lead diz "Ainda não" ---');
  const userMsg = 'Ainda não';
  lead.history.push({ role: 'user', content: userMsg });
  console.log(`👤 USUÁRIO: "${userMsg}"`);

  let sdrResponse: SdrResponse = await generateSdrResponse(lead);
  lead.history.push({ role: 'assistant', content: sdrResponse.response });
  console.log(`🤖 Bot Responde (Estágio: ${sdrResponse.stage}):`);
  console.log(sdrResponse.response);
  console.log('--------------------------------------------------\n');

  // Turno 2: O lead escreve novamente depois de um tempo dizendo que mudou de ideia
  console.log('--- Cenário: Lead muda de ideia e diz "quero cotar" ---');
  const userMsg2 = 'mudei de ideia, quero cotar';
  lead.stage = sdrResponse.stage;
  lead.history.push({ role: 'user', content: userMsg2 });
  console.log(`👤 USUÁRIO: "${userMsg2}"`);

  sdrResponse = await generateSdrResponse(lead);
  lead.history.push({ role: 'assistant', content: sdrResponse.response });
  console.log(`🤖 Bot Responde (Estágio: ${sdrResponse.stage}):`);
  console.log(sdrResponse.response);
  console.log('--------------------------------------------------\n');
}

testLostFlow();
