import { LeadState, Lead } from './state/LeadState';
import { getDb } from './state/db';

async function seedExtra2Profiles() {
  console.log('🌱 Inicializando o Seeding de 10 Perfis de Leads Extras (31 a 40) no Banco de Dados...');

  await getDb();

  const extraLeads2: Lead[] = [
    {
      phone: '5517990000031',
      channel_phone_id: 'default',
      name: 'Roberto (Casamento/Economia)',
      stage: 'PROBLEM',
      status: 'active',
      unread: false,
      has_cnpj: 'não',
      current_plan: 'nenhum',
      num_lives: '2',
      preferred_hospitals: 'Sorocaba',
      document_status: null,
      history: [
        { role: 'user', content: 'Vou casar em breve e preciso de um plano de saúde básico e barato para mim e para minha noiva.' },
        { role: 'assistant', content: 'Olá, Roberto! Parabéns pelo casamento. A Perelli Corretora vai te ajudar a economizar. Qual a idade de vocês?' },
        { role: 'user', content: 'Eu tenho 26 anos e ela tem 25.' }
      ]
    },
    {
      phone: '5517990000032',
      channel_phone_id: 'default',
      name: 'Tatiane (Servidor Público)',
      stage: 'PROBLEM',
      status: 'active',
      unread: true,
      has_cnpj: 'não',
      current_plan: 'nenhum',
      num_lives: '1',
      preferred_hospitals: 'São José do Rio Preto',
      document_status: null,
      history: [
        { role: 'user', content: 'Olá! Sou servidora pública municipal em Rio Preto. Vocês têm plano de saúde especial para a nossa categoria?' },
        { role: 'assistant', content: 'Olá, Tatiane! Temos sim, através dos planos de Adesão com condições especiais por associações. Qual é a sua idade?' },
        { role: 'user', content: 'Tenho 39 anos.' }
      ]
    },
    {
      phone: '5517990000033',
      channel_phone_id: 'default',
      name: 'Gabriel (TI/Home Office)',
      stage: 'PROBLEM',
      status: 'active',
      unread: false,
      has_cnpj: 'sim',
      current_plan: 'nenhum',
      num_lives: '1',
      preferred_hospitals: 'Sorocaba',
      document_status: null,
      history: [
        { role: 'user', content: 'Trabalho com TI de home office e sinto muita dor nas costas. O plano da Austa cobre fisioterapia e RPG sem limites?' },
        { role: 'assistant', content: 'Olá, Gabriel! Sim, o plano cobre fisioterapia indicada por médicos sem limites abusivos, pagando apenas a coparticipação. Você tem CNPJ ativo para baratear?' },
        { role: 'user', content: 'Tenho MEI ativo sim. E tenho 29 anos.' }
      ]
    },
    {
      phone: '5517990000034',
      channel_phone_id: 'default',
      name: 'Camila (Mãe/Filho Autista)',
      stage: 'PROBLEM',
      status: 'active',
      unread: true,
      has_cnpj: 'não',
      current_plan: 'nenhum',
      num_lives: '2',
      preferred_hospitals: 'Campinas',
      document_status: null,
      history: [
        { role: 'user', content: 'Quero plano para mim e meu filho de 6 anos que é autista. Cobre fono e terapia ocupacional?' },
        { role: 'assistant', content: 'Olá, Camila! Cobre sim, com certeza. A Austa garante cobertura multidisciplinar para autismo/TEA. Para calcular os valores, qual sua idade?' },
        { role: 'user', content: 'Tenho 34 anos.' }
      ]
    },
    {
      phone: '5517990000035',
      channel_phone_id: 'default',
      name: 'Valdir (Redução Carência)',
      stage: 'SITUATION',
      status: 'active',
      unread: false,
      has_cnpj: null,
      current_plan: null,
      num_lives: null,
      preferred_hospitals: null,
      document_status: null,
      history: [
        { role: 'user', content: 'Tenho 65 anos e já tenho plano da SulAmérica. Se eu mudar para a Austa, aproveito o tempo que já paguei de carência?' }
      ]
    },
    {
      phone: '5517990000036',
      channel_phone_id: 'default',
      name: 'Joyce (PME Auxiliares)',
      stage: 'SITUATION',
      status: 'active',
      unread: true,
      has_cnpj: null,
      current_plan: null,
      num_lives: null,
      preferred_hospitals: null,
      document_status: null,
      history: [
        { role: 'user', content: 'Tenho um salão de beleza e queria colocar plano para mim e minhas 2 auxiliares que trabalham comigo. Consigo colocar todas no CNPJ?' }
      ]
    },
    {
      phone: '5517990000037',
      channel_phone_id: 'default',
      name: 'Igor Jr. (Estudante Capital)',
      stage: 'PROBLEM',
      status: 'active',
      unread: false,
      has_cnpj: 'não',
      current_plan: 'nenhum',
      num_lives: '1',
      preferred_hospitals: 'São Paulo',
      document_status: null,
      history: [
        { role: 'user', content: 'Quero ver plano para o meu filho que estuda em São Paulo capital. Ele é atendido aí se tiver alguma urgência?' },
        { role: 'assistant', content: 'Olá! Sim, para urgência e emergência ele terá cobertura nacional completa via sistema ABRAMGE da Austa. Qual a idade dele?' },
        { role: 'user', content: 'Ele tem 22 anos. Moro em Rio Preto.' }
      ]
    },
    {
      phone: '5517990000038',
      channel_phone_id: 'default',
      name: 'Juliana (Lesão Crossfit)',
      stage: 'PROBLEM',
      status: 'active',
      unread: true,
      has_cnpj: 'não',
      current_plan: 'nenhum',
      num_lives: '1',
      preferred_hospitals: 'Presidente Prudente',
      document_status: null,
      history: [
        { role: 'user', content: 'Faço crossfit e morro de medo de ter alguma lesão grave ou quebrar um braço. O atendimento ortopédico da Austa é bom?' },
        { role: 'assistant', content: 'Olá, Juliana! Sim, a rede da Austa conta com excelentes clínicas ortopédicas credenciadas e atendimento de emergência rápido. Qual a sua idade e cidade?' },
        { role: 'user', content: 'Tenho 31 anos e moro em Presidente Prudente.' }
      ]
    },
    {
      phone: '5517990000039',
      channel_phone_id: 'default',
      name: 'Henrique (Empresa Migração)',
      stage: 'PROBLEM',
      status: 'active',
      unread: false,
      has_cnpj: 'sim',
      current_plan: 'Bradesco',
      num_lives: '3',
      preferred_hospitals: 'Campinas',
      document_status: null,
      history: [
        { role: 'user', content: 'Temos um plano PME da Bradesco para os 3 sócios da empresa mas veio reajuste de 25%. Queremos migrar para a Austa para economizar.' },
        { role: 'assistant', content: 'Olá, Henrique! Ótima decisão, a Austa PME tem valores muito competitivos. Quais as idades dos 3 sócios?' },
        { role: 'user', content: 'Eu tenho 41, meu sócio 45 e o outro 33.' }
      ]
    },
    {
      phone: '5517990000040',
      channel_phone_id: 'default',
      name: 'Thiago (Filho Adotivo)',
      stage: 'SITUATION',
      status: 'active',
      unread: true,
      has_cnpj: null,
      current_plan: null,
      num_lives: null,
      preferred_hospitals: null,
      document_status: null,
      history: [
        { role: 'user', content: 'Meu companheiro e eu estamos finalizando a adoção de um bebê recém-nascido. Como funciona para colocar ele no plano? Tem carência?' }
      ]
    }
  ];

  try {
    for (const lead of extraLeads2) {
      console.log(`💾 Salvando lead extra 2: ${lead.name} (${lead.phone}) no estágio ${lead.stage}...`);
      await LeadState.saveLead(lead);
    }
    console.log('✅ Mais 10 perfis de leads extras (31 a 40) criados com sucesso!');
  } catch (error) {
    console.error('❌ Erro no seeding extra 2:', error);
  }
}

seedExtra2Profiles();
