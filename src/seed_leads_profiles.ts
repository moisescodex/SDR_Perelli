import { LeadState, Lead, Message } from './state/LeadState';
import { getDb } from './state/db';

async function seedProfiles() {
  console.log('🌱 Inicializando o Seeding de 10 Perfis de Leads no Banco de Dados...');

  // Garante conexão do banco de dados antes de rodar
  await getDb();

  const leadsToSeed: Lead[] = [
    {
      phone: '5517990000001',
      channel_phone_id: 'default',
      name: 'Ana Maria (Decidida)',
      stage: 'CONVERTED',
      status: 'active',
      unread: false,
      has_cnpj: 'não',
      current_plan: 'nenhum',
      num_lives: '28',
      preferred_hospitals: 'São José do Rio Preto',
      document_status: JSON.stringify({
        rg_cnh: { type: 'cnh', valid: true, feedback: 'CNH legível e válida.' },
        residence: { type: 'comprovante_residencia', valid: true, feedback: 'Comprovante de residência legível e válido.' }
      }),
      history: [
        { role: 'user', content: 'Oi, bom dia! Gostaria de cotar um plano de saúde individual para mim.' },
        { role: 'assistant', content: 'Olá, Ana! Tudo bem? Para eu te ajudar a encontrar o melhor plano de saúde, qual é a sua idade?' },
        { role: 'user', content: 'Tenho 28 anos.' },
        { role: 'assistant', content: 'Entendi, 28 anos! E qual é a sua cidade?' },
        { role: 'user', content: 'Moro em São José do Rio Preto.' },
        { role: 'assistant', content: 'Perfeito. Atualmente você faz algum tipo de tratamento médico ou acompanhamento?' },
        { role: 'user', content: 'Não, nenhum.' },
        { role: 'assistant', content: 'Certo! E você possui CNPJ ou MEI ativo?' },
        { role: 'user', content: 'Não tenho CNPJ.' },
        { role: 'assistant', content: 'Que ótimo! Com base nisso, consultei a tabela AUSTA Adesão Medida Certa 50 STD. Fica R$ 162,85 por mês mais taxa associativa. Gostou desses valores?' },
        { role: 'user', content: 'Gostei sim! Como faço para fechar?' },
        { role: 'assistant', content: 'Perfeito! Para darmos início à contratação, preciso que envie por aqui fotos bem legíveis dos seguintes documentos:\n\n🧾 DOCUMENTOS NECESSÁRIOS:\nTITULAR\n📸 FOTOS LEGIVEIS \n\n📧 EMAIL\n🪪 RG ou CNH (FRENTE E VERSO) \n🏠 COMPROVANTE DE RESIDENCIA' },
        { role: 'user', content: '[Imagem enviada - Tipo: cnh, Legível: true, É Documento: true, Feedback: CNH legível e válida.]' },
        { role: 'user', content: '[Imagem enviada - Tipo: comprovante_residencia, Legível: true, É Documento: true, Feedback: Comprovante de residência legível e válido.]' },
        { role: 'assistant', content: 'Excelente! Recebi tanto a sua identificação quanto o comprovante de residência e estão perfeitos. Agora, o próximo passo é o nosso consultor humano entrar em contato para te auxiliar no cadastro final e validar tudo na operadora.' }
      ]
    },
    {
      phone: '5517990000002',
      channel_phone_id: 'default',
      name: 'Bruno MEI (Focado)',
      stage: 'MEETING_SCHEDULED',
      status: 'active',
      unread: true,
      has_cnpj: 'sim',
      current_plan: 'Unimed',
      num_lives: '35',
      preferred_hospitals: 'Sorocaba',
      document_status: JSON.stringify({
        rg_cnh: { type: 'rg', valid: true, feedback: 'RG legível e válido.' },
        residence: null
      }),
      history: [
        { role: 'user', content: 'Olá, tenho MEI e queria ver se o plano da Austa é mais barato que o meu atual da Unimed.' },
        { role: 'assistant', content: 'Com certeza, Bruno! Se você tem CNPJ conseguimos até 35% de desconto. Qual é a sua idade?' },
        { role: 'user', content: 'Tenho 35 anos.' },
        { role: 'assistant', content: 'Ótimo! E você é de qual cidade?' },
        { role: 'user', content: 'Sou de Sorocaba.' },
        { role: 'assistant', content: 'Perfeito. Faz algum tratamento contínuo ou toma medicamentos?' },
        { role: 'user', content: 'Não, tudo certo com a saúde.' },
        { role: 'assistant', content: 'Legal! O seu plano Austa Empresarial no Medida Certa 50 STD fica R$ 198,70 (Enfermaria). Ficou melhor que o seu atual?' },
        { role: 'user', content: 'Sim, bem mais em conta! Quero fazer.' },
        { role: 'assistant', content: 'Maravilha, Bruno! Para darmos início à contratação, preciso que envie por aqui fotos bem legíveis dos seguintes documentos:\n\n🧾 DOCUMENTOS NECESSÁRIOS:\nTITULAR\n📸 FOTOS LEGIVEIS \n\n📧 EMAIL\n🪪 RG ou CNH (FRENTE E VERSO) \n🏠 COMPROVANTE DE RESIDENCIA' },
        { role: 'user', content: '[Imagem enviada - Tipo: rg, Legível: true, É Documento: true, Feedback: RG legível e válido.]' }
      ]
    },
    {
      phone: '5517990000003',
      channel_phone_id: 'default',
      name: 'Carlos (Desconfiado)',
      stage: 'MEETING_SCHEDULED',
      status: 'active',
      unread: false,
      has_cnpj: 'não',
      current_plan: 'nenhum',
      num_lives: '45',
      preferred_hospitals: 'Campinas',
      document_status: null,
      history: [
        { role: 'user', content: 'Quero ver os preços da Austa, mas já aviso que não gosto dessas taxas escondidas.' },
        { role: 'assistant', content: 'Entendo perfeitamente, Carlos! Aqui somos 100% transparentes. Para eu calcular os valores reais de tabela, qual a sua idade?' },
        { role: 'user', content: 'Tenho 45 anos.' },
        { role: 'assistant', content: 'Obrigado! Qual é a sua cidade?' },
        { role: 'user', content: 'Moro em Campinas.' },
        { role: 'assistant', content: 'Excelente! Faz algum acompanhamento ou tratamento médico?' },
        { role: 'user', content: 'Não.' },
        { role: 'assistant', content: 'E você possui CNPJ ou MEI ativo?' },
        { role: 'user', content: 'Não tenho essas coisas.' },
        { role: 'assistant', content: 'Perfeito. Fica R$ 321,70 na enfermaria pelo plano de Adesão. O que achou do valor?' },
        { role: 'user', content: 'Esse valor é de coparticipação? O que significa? É use e pague?' },
        { role: 'assistant', content: 'Isso mesmo, Carlos! O plano funciona com coparticipação (use e pague), onde você só paga taxas muito pequenas por consultas e exames que realizar. Vou te mandar um áudio explicando certinho.' },
        { role: 'user', content: 'Entendi. E se eu quiser fechar o que precisa?' }
      ]
    },
    {
      phone: '5517990000004',
      channel_phone_id: 'default',
      name: 'Daniela (Sem Tempo)',
      stage: 'PROBLEM',
      status: 'active',
      unread: true,
      has_cnpj: null,
      current_plan: null,
      num_lives: null,
      preferred_hospitals: null,
      document_status: null,
      history: [
        { role: 'user', content: 'Cotação austa sff' },
        { role: 'assistant', content: 'Olá, Daniela! Tudo bem? Para eu encontrar a melhor opção de plano da AUSTA para você, me conta: qual é a sua idade?' },
        { role: 'user', content: '32' },
        { role: 'assistant', content: 'Entendi, 32 anos! E qual é a sua cidade?' },
        { role: 'user', content: 'SP' }
      ]
    },
    {
      phone: '5517990000005',
      channel_phone_id: 'default',
      name: 'Eduardo (Recusado/LOST)',
      stage: 'LOST',
      status: 'active',
      unread: false,
      has_cnpj: 'não',
      current_plan: 'nenhum',
      num_lives: '50',
      preferred_hospitals: 'Bauru',
      document_status: null,
      history: [
        { role: 'user', content: 'Valores do plano de saude pf' },
        { role: 'assistant', content: 'Olá, Eduardo! Tudo bem? Para eu encontrar a melhor opção de plano da AUSTA para você, me conta: qual é a sua idade?' },
        { role: 'user', content: 'Tenho 50 anos e moro em Bauru.' },
        { role: 'assistant', content: 'Entendi! Bauru é uma ótima cidade. Você faz algum tipo de tratamento médico?' },
        { role: 'user', content: 'Não tenho interesse, deixa pra lá. Achei que mandavam os preços direto.' },
        { role: 'assistant', content: 'Entendo perfeitamente, Eduardo! Sem problemas, a correria do dia a dia acontece. Se no futuro você quiser economizar ou simular um plano de saúde pela Perelli Corretora, fique à vontade para me chamar por aqui. Desejo um excelente dia para você!' }
      ]
    },
    {
      phone: '5517990000006',
      channel_phone_id: 'default',
      name: 'Fabiana (Curiosa/Extra)',
      stage: 'NEED_PAYOFF',
      status: 'active',
      unread: false,
      has_cnpj: 'não',
      current_plan: 'nenhum',
      num_lives: '29',
      preferred_hospitals: 'Ribeirão Preto',
      document_status: null,
      history: [
        { role: 'user', content: 'Quero um plano de saúde, estou planejando engravidar ano que vem. O plano da Austa cobre parto?' },
        { role: 'assistant', content: 'Olá, Fabiana! Cobre sim, o plano Medida Certa tem cobertura obstétrica completa. Para eu te passar o valor certinho, qual a sua idade?' },
        { role: 'user', content: 'Tenho 29 anos.' },
        { role: 'assistant', content: 'Certo! E qual é a sua cidade?' },
        { role: 'user', content: 'Moro em Ribeirão Preto.' },
        { role: 'assistant', content: 'Perfeito. Atualmente você faz algum tratamento médico ou toma remédios?' },
        { role: 'user', content: 'Não, apenas vitaminas.' },
        { role: 'assistant', content: 'Entendi. E possui CNPJ ou MEI ativo no seu nome?' },
        { role: 'user', content: 'Não tenho CNPJ.' },
        { role: 'assistant', content: 'Certo, o plano Austa Adesão para a sua idade fica R$ 179,95 mensal (STD enfermaria), com coparticipação. Estou te enviando o PDF da proposta para você olhar os detalhes. O que achou desse valor?' }
      ]
    },
    {
      phone: '5517990000007',
      channel_phone_id: 'default',
      name: 'Gustavo (Familiar)',
      stage: 'NEED_PAYOFF',
      status: 'active',
      unread: true,
      has_cnpj: 'sim',
      current_plan: 'Sulamérica',
      num_lives: '4',
      preferred_hospitals: 'Santos',
      document_status: null,
      history: [
        { role: 'user', content: 'Consigo colocar minha esposa e 2 filhos no MEI?' },
        { role: 'assistant', content: 'Olá, Gustavo! Consegue sim, o MEI aceita dependentes familiares diretos. Qual a idade de vocês?' },
        { role: 'user', content: 'Eu tenho 42, minha esposa 39 e meus filhos têm 12 e 15.' },
        { role: 'assistant', content: 'Entendido! E vocês moram em qual cidade?' },
        { role: 'user', content: 'Mora todo mundo em Santos.' },
        { role: 'assistant', content: 'Perfeito. Alguém faz tratamento médico contínuo?' },
        { role: 'user', content: 'Não, ninguém.' },
        { role: 'assistant', content: 'Ótimo. Pelo CNPJ o total de vocês 4 fica R$ 717,06 (sendo R$ 227,84 para você, R$ 227,84 para sua esposa e R$ 130,69 para cada filho). Ficou um preço bacana para você?' }
      ]
    },
    {
      phone: '5517990000008',
      channel_phone_id: 'default',
      name: 'Heloísa (Enrolada)',
      stage: 'MEETING_SCHEDULED',
      status: 'active',
      unread: false,
      has_cnpj: 'não',
      current_plan: 'nenhum',
      num_lives: '26',
      preferred_hospitals: 'São José do Rio Preto',
      document_status: JSON.stringify({
        rg_cnh: null,
        residence: { type: 'comprovante_residencia', valid: true, feedback: 'Comprovante legível.' }
      }),
      history: [
        { role: 'user', content: 'Oi, quero simular Austa.' },
        { role: 'assistant', content: 'Olá, Heloísa! Tudo bem? Para eu te ajudar a encontrar o melhor plano de saúde, qual é a sua idade?' },
        { role: 'user', content: 'Tenho 26 anos.' },
        { role: 'assistant', content: 'Entendi, 26 anos! E qual é a sua cidade?' },
        { role: 'user', content: 'São José do Rio Preto.' },
        { role: 'assistant', content: 'Perfeito. Atualmente você faz algum tipo de tratamento médico?' },
        { role: 'user', content: 'Não.' },
        { role: 'assistant', content: 'Certo! E você possui CNPJ ou MEI ativo?' },
        { role: 'user', content: 'Não tenho.' },
        { role: 'assistant', content: 'Com base nisso, o plano de Adesão fica R$ 162,85 mensal. Fica bom pra você?' },
        { role: 'user', content: 'Sim, fica ótimo. Quero contratar.' },
        { role: 'assistant', content: 'Perfeito! Para darmos início à contratação, preciso que envie por aqui fotos bem legíveis dos seguintes documentos:\n\n🧾 DOCUMENTOS NECESSÁRIOS:\nTITULAR\n📸 FOTOS LEGIVEIS \n\n📧 EMAIL\n🪪 RG ou CNH (FRENTE E VERSO) \n🏠 COMPROVANTE DE RESIDENCIA' },
        { role: 'user', content: '[Imagem enviada - Tipo: comprovante_residencia, Legível: true, É Documento: true, Feedback: Comprovante de residência legível e válido.]' },
        { role: 'user', content: 'O comprovante está no nome do meu pai tem problema? E a foto da CNH está no meu carro, posso mandar mais tarde?' },
        { role: 'assistant', content: 'Não tem problema nenhum o comprovante estar no nome do seu pai, Heloísa! Já validei ele por aqui. Fico no aguardo da foto da CNH (frente e verso fora do plástico) assim que você pegar no carro, tá bom?' }
      ]
    },
    {
      phone: '5517990000009',
      channel_phone_id: 'default',
      name: 'Igor (Rabugento)',
      stage: 'NEED_PAYOFF',
      status: 'active',
      unread: false,
      has_cnpj: 'sim',
      current_plan: 'Amil',
      num_lives: '55',
      preferred_hospitals: 'Rio de Janeiro',
      document_status: null,
      history: [
        { role: 'user', content: 'Odeio falar com robô. Mandem a tabela logo.' },
        { role: 'assistant', content: 'Entendo perfeitamente o seu lado, Igor! Robôs podem ser chatos, mas prometo ser rápido para te ajudar. Para eu te dar o preço exato da sua tabela de CNPJ ou individual, qual a sua idade?' },
        { role: 'user', content: '55 anos.' },
        { role: 'assistant', content: 'Obrigado pela paciência! E qual é a sua cidade?' },
        { role: 'user', content: 'Rio de Janeiro.' },
        { role: 'assistant', content: 'Perfeito. Faz algum tratamento médico de saúde atualmente?' },
        { role: 'user', content: 'Apenas pressão alta, controlado.' },
        { role: 'assistant', content: 'Entendido. E você possui CNPJ ou MEI ativo?' },
        { role: 'user', content: 'Tenho MEI.' },
        { role: 'assistant', content: 'Excelente. No plano AUSTA Empresarial Medida Certa 50 STD, a mensalidade para a sua idade fica R$ 467,12, com coparticipação. Segue o PDF da tabela oficial. O que achou desse valor?' }
      ]
    },
    {
      phone: '5517990000010',
      channel_phone_id: 'default',
      name: 'Julia (Reativada)',
      stage: 'SITUATION',
      status: 'active',
      unread: true,
      has_cnpj: null,
      current_plan: null,
      num_lives: null,
      preferred_hospitals: null,
      document_status: null,
      history: [
        { role: 'user', content: 'Quero cotar plano' },
        { role: 'assistant', content: 'Olá! Para eu te passar os valores da Austa, qual é a sua idade?' },
        { role: 'user', content: 'Não quero mais não, muito corrido' },
        { role: 'assistant', content: 'Entendo perfeitamente! Se no futuro você quiser fazer uma cotação para economizar no plano de saúde ou se quiser tirar dúvidas, pode me mandar uma mensagem por aqui. Fico à disposição. Um ótimo dia para você!' },
        { role: 'user', content: 'oi, mudei de ideia, podemos voltar?' }
      ]
    }
  ];

  try {
    // Insere os leads no banco de dados usando a classe LeadState
    for (const lead of leadsToSeed) {
      console.log(`💾 Salvando lead: ${lead.name} (${lead.phone}) no estágio ${lead.stage}...`);
      await LeadState.saveLead(lead);
    }
    console.log('✅ Todos os 10 perfis de leads foram criados com sucesso!');
  } catch (error) {
    console.error('❌ Erro durante o seeding dos leads:', error);
  }
}

seedProfiles();
