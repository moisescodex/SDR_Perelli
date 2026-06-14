import { LeadState, Lead } from './state/LeadState';
import { getDb } from './state/db';

async function seedExtraProfiles() {
  console.log('🌱 Inicializando o Seeding de 20 Perfis de Leads Adicionais no Banco de Dados...');

  await getDb();

  const extraLeads: Lead[] = [
    {
      phone: '5517990000011',
      channel_phone_id: 'default',
      name: 'Marcos (Migração Unimed)',
      stage: 'PROBLEM',
      status: 'active',
      unread: false,
      has_cnpj: 'sim',
      current_plan: 'Unimed',
      num_lives: '44',
      preferred_hospitals: 'São José do Rio Preto',
      document_status: null,
      history: [
        { role: 'user', content: 'Bom dia. Pago 650 no meu plano da Unimed individual, sou MEI. Consigo economizar na Austa?' },
        { role: 'assistant', content: 'Olá, Marcos! Com certeza consegue sim. O plano pelo MEI tem desconto de até 35%. Qual a sua idade?' },
        { role: 'user', content: 'Tenho 44 anos.' },
        { role: 'assistant', content: 'Entendi, 44 anos! E qual é a sua cidade?' },
        { role: 'user', content: 'Moro em Rio Preto mesmo.' }
      ]
    },
    {
      phone: '5517990000012',
      channel_phone_id: 'default',
      name: 'Sandra (Idosa/Adesão)',
      stage: 'NEED_PAYOFF',
      status: 'active',
      unread: true,
      has_cnpj: 'não',
      current_plan: 'nenhum',
      num_lives: '62',
      preferred_hospitals: 'São José do Rio Preto',
      document_status: null,
      history: [
        { role: 'user', content: 'Tenho 62 anos e queria saber os preços do plano de saúde. Tenho medo de reajustes absurdos.' },
        { role: 'assistant', content: 'Olá, Sandra! Seja bem-vinda. Entendo a sua preocupação. O reajuste do nosso plano por Adesão ocorre anualmente em Setembro. Para eu ver o valor correto, você reside em qual cidade?' },
        { role: 'user', content: 'Moro em Rio Preto.' },
        { role: 'assistant', content: 'Ótimo. Faz algum tratamento contínuo ou toma medicamentos?' },
        { role: 'user', content: 'Não faço nenhum.' },
        { role: 'assistant', content: 'E possui CNPJ ativo?' },
        { role: 'user', content: 'Não tenho.' },
        { role: 'assistant', content: 'Perfeito, Sandra. O plano Austa Adesão Medida Certa 50 STD para a faixa acima de 59 anos fica R$ 737,03 + taxa associativa. E após assinar, a operadora não pode cancelar seu plano unilateralmente. Fica bom pra você?' }
      ]
    },
    {
      phone: '5517990000013',
      channel_phone_id: 'default',
      name: 'Patrícia (Mãe Solo)',
      stage: 'PROBLEM',
      status: 'active',
      unread: false,
      has_cnpj: null,
      current_plan: null,
      num_lives: null,
      preferred_hospitals: null,
      document_status: null,
      history: [
        { role: 'user', content: 'Gostaria de cotar plano para mim e meu filho de 2 anos. O pronto-socorro infantil da Austa em Rio Preto é bom?' },
        { role: 'assistant', content: 'Olá, Patrícia! Sim, o pronto-socorro da Austa tem ala infantil excelente com pediatras 24h. Qual a sua idade?' },
        { role: 'user', content: 'Tenho 31 anos.' }
      ]
    },
    {
      phone: '5517990000014',
      channel_phone_id: 'default',
      name: 'Tiago (Jovem Freelancer)',
      stage: 'PROBLEM',
      status: 'active',
      unread: true,
      has_cnpj: 'não',
      current_plan: 'nenhum',
      num_lives: '23',
      preferred_hospitals: 'Campinas',
      document_status: null,
      history: [
        { role: 'user', content: 'Quero um plano só por segurança caso aconteça algum acidente, mas sou autônomo e não posso gastar muito.' },
        { role: 'assistant', content: 'Fala, Tiago! Certíssimo, é bom ter segurança. Qual a sua idade e cidade?' },
        { role: 'user', content: 'Tenho 23 anos e moro em Campinas.' },
        { role: 'assistant', content: 'Entendi! Faz algum tratamento de saúde atualmente?' },
        { role: 'user', content: 'Não, tudo limpo.' },
        { role: 'assistant', content: 'Perfeito. E tem MEI ou CNPJ?' },
        { role: 'user', content: 'Não tenho.' }
      ]
    },
    {
      phone: '5517990000015',
      channel_phone_id: 'default',
      name: 'Roberto (Produtor Rural)',
      stage: 'PROBLEM',
      status: 'active',
      unread: false,
      has_cnpj: null,
      current_plan: null,
      num_lives: null,
      preferred_hospitals: null,
      document_status: null,
      history: [
        { role: 'user', content: 'Moro em sítio perto de Onda Verde. O plano atende em clínicas de cidades pequenas?' },
        { role: 'assistant', content: 'Olá, Roberto! O plano atende sim nas principais redes credenciadas da região de Rio Preto e urgências em todo o Brasil. Qual é a sua idade?' },
        { role: 'user', content: 'Tenho 52 anos.' }
      ]
    },
    {
      phone: '5517990000016',
      channel_phone_id: 'default',
      name: 'Glória (Doença Preexistente)',
      stage: 'SITUATION',
      status: 'active',
      unread: true,
      has_cnpj: null,
      current_plan: null,
      num_lives: null,
      preferred_hospitals: null,
      document_status: null,
      history: [
        { role: 'user', content: 'Quero cotar plano Austa, mas sou diabética. Posso contratar mesmo assim?' }
      ]
    },
    {
      phone: '5517990000017',
      channel_phone_id: 'default',
      name: 'Fernando (Sem Tempo)',
      stage: 'PROBLEM',
      status: 'active',
      unread: false,
      has_cnpj: 'sim',
      current_plan: 'nenhum',
      num_lives: '38',
      preferred_hospitals: 'Presidente Prudente',
      document_status: null,
      history: [
        { role: 'user', content: 'quero cotar. tenho mei' },
        { role: 'assistant', content: 'Olá, Fernando! Com MEI temos desconto. Qual é a sua idade?' },
        { role: 'user', content: '38' },
        { role: 'assistant', content: 'Entendi, 38 anos! E qual é a sua cidade?' },
        { role: 'user', content: 'Prudente' }
      ]
    },
    {
      phone: '5517990000018',
      channel_phone_id: 'default',
      name: 'Aline (Dúvida Parto)',
      stage: 'PROBLEM',
      status: 'active',
      unread: true,
      has_cnpj: null,
      current_plan: null,
      num_lives: null,
      preferred_hospitals: null,
      document_status: null,
      history: [
        { role: 'user', content: 'Estou planejando engravidar. Se eu contratar hoje, o parto está coberto?' },
        { role: 'assistant', content: 'Olá, Aline! A carência regulamentar da ANS para parto é de 300 dias. Urgências gestacionais cobrem após 24h. Qual sua idade?' },
        { role: 'user', content: 'Tenho 27 anos.' }
      ]
    },
    {
      phone: '5517990000019',
      channel_phone_id: 'default',
      name: 'Lucas (Desconfiado Golpe)',
      stage: 'SITUATION',
      status: 'active',
      unread: false,
      has_cnpj: null,
      current_plan: null,
      num_lives: null,
      preferred_hospitals: null,
      document_status: null,
      history: [
        { role: 'user', content: 'Já me passaram a perna na internet com corretor falso. Vocês são empresa séria mesmo? Onde fica?' }
      ]
    },
    {
      phone: '5517990000020',
      channel_phone_id: 'default',
      name: 'Regina (Dona de Casa)',
      stage: 'PROBLEM',
      status: 'active',
      unread: true,
      has_cnpj: 'não',
      current_plan: 'nenhum',
      num_lives: '51',
      preferred_hospitals: 'Sorocaba',
      document_status: null,
      history: [
        { role: 'user', content: 'Como funciona esse negócio de coparticipação? Paga quanto por consulta?' },
        { role: 'assistant', content: 'Olá, Regina! A coparticipação é igual a seguro de carro: a mensalidade fica bem mais barata e você só paga uma taxa pequena se usar. Exemplo: consultas R$ 35,00. Qual sua idade?' },
        { role: 'user', content: 'Tenho 51 anos.' },
        { role: 'assistant', content: 'Certo, 51 anos! E qual é a sua cidade?' },
        { role: 'user', content: 'Sorocaba' }
      ]
    },
    {
      phone: '5517990000021',
      channel_phone_id: 'default',
      name: 'Ricardo (Orçamento Justo)',
      stage: 'SITUATION',
      status: 'active',
      unread: false,
      has_cnpj: null,
      current_plan: null,
      num_lives: null,
      preferred_hospitals: null,
      document_status: null,
      history: [
        { role: 'user', content: 'Se atrasar boleto cancela na hora? Posso parcelar a primeira?' }
      ]
    },
    {
      phone: '5517990000022',
      channel_phone_id: 'default',
      name: 'Vanessa (Analítica)',
      stage: 'SITUATION',
      status: 'active',
      unread: true,
      has_cnpj: null,
      current_plan: null,
      num_lives: null,
      preferred_hospitals: null,
      document_status: null,
      history: [
        { role: 'user', content: 'Qual a nota da Austa na ANS e o índice no Reclame Aqui?' }
      ]
    },
    {
      phone: '5517990000023',
      channel_phone_id: 'default',
      name: 'Marcelo (MEI Recente)',
      stage: 'PROBLEM',
      status: 'active',
      unread: false,
      has_cnpj: 'sim',
      current_plan: 'nenhum',
      num_lives: '33',
      preferred_hospitals: 'São José do Rio Preto',
      document_status: null,
      history: [
        { role: 'user', content: 'Abri meu MEI faz 15 dias. Já posso fazer o plano empresarial?' },
        { role: 'assistant', content: 'Olá, Marcelo! Pode sim! A Austa aceita contratação para CNPJ ativo recente. Qual é a sua idade?' },
        { role: 'user', content: 'Tenho 33 anos.' }
      ]
    },
    {
      phone: '5517990000024',
      channel_phone_id: 'default',
      name: 'Cláudia (Responsável Neto)',
      stage: 'PROBLEM',
      status: 'active',
      unread: true,
      has_cnpj: 'não',
      current_plan: 'nenhum',
      num_lives: '1',
      preferred_hospitals: 'Sorocaba',
      document_status: null,
      history: [
        { role: 'user', content: 'Quero fazer plano para o meu neto de 5 anos, eu pago.' },
        { role: 'assistant', content: 'Olá, Cláudia! É possível sim, colocamos seu neto de 5 anos como titular menor e você como responsável financeira. Qual sua cidade?' },
        { role: 'user', content: 'Sorocaba' }
      ]
    },
    {
      phone: '5517990000025',
      channel_phone_id: 'default',
      name: 'André (Fisioterapia/Lesão)',
      stage: 'SITUATION',
      status: 'active',
      unread: false,
      has_cnpj: null,
      current_plan: null,
      num_lives: null,
      preferred_hospitals: null,
      document_status: null,
      history: [
        { role: 'user', content: 'Tenho lesão no joelho e preciso fazer fisioterapia. O plano tem limite de sessões de fisio por ano?' }
      ]
    },
    {
      phone: '5517990000026',
      channel_phone_id: 'default',
      name: 'Letícia (Estudante/Pais)',
      stage: 'PROBLEM',
      status: 'active',
      unread: true,
      has_cnpj: 'não',
      current_plan: 'nenhum',
      num_lives: '1',
      preferred_hospitals: 'Ribeirão Preto',
      document_status: null,
      history: [
        { role: 'user', content: 'Oi, sou estudante em Ribeirão Preto e meus pais vão pagar um plano para mim, queria o mais barato.' },
        { role: 'assistant', content: 'Olá, Letícia! Excelente. O plano por adesão estudantil tem condições excelentes. Qual é a sua idade?' },
        { role: 'user', content: '21 anos.' }
      ]
    },
    {
      phone: '5517990000027',
      channel_phone_id: 'default',
      name: 'Samuel (Sindicato/Adesão)',
      stage: 'SITUATION',
      status: 'active',
      unread: false,
      has_cnpj: null,
      current_plan: null,
      num_lives: null,
      preferred_hospitals: null,
      document_status: null,
      history: [
        { role: 'user', content: 'Para fazer o plano de adesão eu preciso estar filiado a alguma associação ou sindicato?' }
      ]
    },
    {
      phone: '5517990000028',
      channel_phone_id: 'default',
      name: 'Beatriz (Exames Complexos)',
      stage: 'SITUATION',
      status: 'active',
      unread: true,
      has_cnpj: null,
      current_plan: null,
      num_lives: null,
      preferred_hospitals: null,
      document_status: null,
      history: [
        { role: 'user', content: 'Preciso fazer ressonância magnética a cada 6 meses. O plano cobra coparticipação muito alta para isso?' }
      ]
    },
    {
      phone: '5517990000029',
      channel_phone_id: 'default',
      name: 'Renato (Empresário/Sócios)',
      stage: 'PROBLEM',
      status: 'active',
      unread: false,
      has_cnpj: 'sim',
      current_plan: 'Bradesco',
      num_lives: '5',
      preferred_hospitals: 'Campinas',
      document_status: null,
      history: [
        { role: 'user', content: 'Gostaria de cotar plano PME para mim, meu sócio e 3 funcionários.' },
        { role: 'assistant', content: 'Olá, Renato! Ótimo, o plano PME da Austa aceita a partir de 2 vidas. Quais são as idades do grupo?' },
        { role: 'user', content: 'Eu 40, meu sócio 42, funcionários 22, 28 e 31.' }
      ]
    },
    {
      phone: '5517990000030',
      channel_phone_id: 'default',
      name: 'Carina (Telemedicina 24h)',
      stage: 'PROBLEM',
      status: 'active',
      unread: true,
      has_cnpj: 'não',
      current_plan: 'nenhum',
      num_lives: '1',
      preferred_hospitals: 'Santos',
      document_status: null,
      history: [
        { role: 'user', content: 'O plano tem consulta online pelo celular? Não gosto de ir no hospital e pegar fila.' },
        { role: 'assistant', content: 'Olá, Carina! Tem sim, a Austa oferece telemedicina 24h por vídeo no app. Qual é a sua idade?' },
        { role: 'user', content: '36 anos' }
      ]
    }
  ];

  try {
    for (const lead of extraLeads) {
      console.log(`💾 Salvando lead adicional: ${lead.name} (${lead.phone}) no estágio ${lead.stage}...`);
      await LeadState.saveLead(lead);
    }
    console.log('✅ Mais 20 perfis de leads adicionais criados com sucesso!');
  } catch (error) {
    console.error('❌ Erro no seeding extra:', error);
  }
}

seedExtraProfiles();
