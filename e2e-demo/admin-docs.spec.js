import { expect } from '@playwright/test'
import { createSalon } from '../e2e/support/salon.js'
import { createProfessional } from '../e2e/support/team.js'
import { say, glide, tap, typeQuick, pickQuick, chooseSlow, field, drawer, goTo, pause } from './support/kit.js'
import { docVideo } from './support/doc.js'

// Um vídeo de até 30 s por tópico do Docs do Admin (legenda gravada no vídeo).
// Rodar um só:  npx playwright test -c playwright.demo.config.js e2e-demo/admin-docs.spec.js -g "Caixa"

docVideo({
  slug: 'dashboard', title: 'Dashboard',
  open: async (p, { base }) => {
    await p.goto(`${base}/dashboard`)
    await expect(p.getByText('Receita do período')).toBeVisible()
  },
  run: async (p) => {
    await say(p, 'O Dashboard resume o movimento do salão')
    await glide(p, p.getByRole('heading', { name: 'Hoje' }))
    await say(p, 'Em cima, o dia de hoje: agendamentos, receita e comandas abertas')
    await glide(p, p.getByText('Comandas abertas', { exact: true }))
    await say(p, 'Troque o período para comparar: 7, 30, 60 ou 90 dias')
    await tap(p, p.getByRole('button', { name: '30 dias' }), 900)
    await glide(p, p.getByText('Ticket médio', { exact: true }))
    await say(p, 'Receita, ticket médio e cancelamentos do período')
    await glide(p, p.getByRole('heading', { name: 'Receita diária' }))
    await say(p, 'O gráfico mostra a receita de cada dia')
    await glide(p, p.getByRole('heading', { name: 'Ranking de profissionais' }))
    await say(p, 'E o ranking mostra quem mais gerou receita')
    await pause(p, 1500)
  },
})

docVideo({
  slug: 'agenda', title: 'Agenda',
  open: async (p, { base, days }) => {
    await p.goto(base)
    await p.getByLabel('Ir para a data').fill(days.agenda)
    await expect(p.getByRole('button', { name: /Cliente 2/ })).toBeVisible()
  },
  run: async (p) => {
    await say(p, 'A Agenda mostra a equipe toda: uma coluna por profissional')
    await glide(p, p.getByRole('button', { name: /Cliente 5/ }))
    await say(p, 'Para agendar, clique num horário livre')
    await tap(p, p.getByRole('button', { name: 'Agendar 11:00 com Profissional 2' }), 1000)
    const d = p.locator('div')
      .filter({ has: p.getByRole('heading', { name: 'Novo agendamento' }) })
      .filter({ has: p.getByRole('button', { name: 'Confirmar agendamento' }) }).last()
    await say(p, 'Escolha o cliente e o serviço')
    await pickQuick(p, d.getByRole('button', { name: 'Selecionar cliente…' }), 'Cliente 9')
    await pickQuick(p, d.getByRole('button', { name: 'Selecionar serviço…' }).first(), 'Serviço 2')
    await tap(p, d.getByRole('button', { name: 'Confirmar agendamento' }), 600)
    await p.getByText('Agendamento criado!').waitFor()
    await say(p, 'Pronto! O horário já aparece na agenda')
    await glide(p, p.getByRole('button', { name: /Cliente 9/ }))
  },
})

docVideo({
  slug: 'agendamentos', title: 'Agendamentos',
  open: async (p, { base }) => {
    await p.goto(`${base}/agendamentos`)
    await expect(p.getByRole('row', { name: /Cliente 4/ })).toBeVisible()
  },
  run: async (p) => {
    await say(p, 'Agendamentos lista tudo o que está marcado no salão')
    await glide(p, p.getByRole('row', { name: /Cliente 4/ }))
    await say(p, 'Data, horário, cliente, profissional, serviço e status')
    await say(p, 'Para achar um cliente, use a busca')
    await typeQuick(p, p.getByPlaceholder('Buscar por cliente...'), 'Cliente 8')
    await glide(p, p.getByRole('row', { name: /Cliente 8/ }))
    await say(p, 'As abas separam ativos, concluídos e cancelados')
    await tap(p, p.getByRole('button', { name: /^Concluídos/ }), 1000)
    await tap(p, p.getByRole('button', { name: /^Cancelados/ }), 900)
    await say(p, 'E o botão Novo agendamento marca um horário direto daqui')
    await glide(p, p.getByRole('button', { name: 'Novo agendamento' }))
    await pause(p, 1200)
  },
})

docVideo({
  slug: 'clientes', title: 'Clientes',
  open: async (p, { base }) => {
    await p.goto(`${base}/usuarios`)
    await expect(p.getByRole('row', { name: /Cliente 2/ })).toBeVisible()
  },
  run: async (p) => {
    await say(p, 'Clientes reúne todas as pessoas do salão')
    await glide(p, p.getByRole('button', { name: 'Profissional', exact: true }))
    await say(p, 'Filtre por função, comanda aberta ou mensalistas')
    await glide(p, p.getByRole('button', { name: /Comanda aberta/ }))
    await say(p, 'Ou busque pelo nome')
    await typeQuick(p, p.getByPlaceholder('Buscar por nome ou telefone…'), 'Cliente 2')
    await tap(p, p.getByRole('row', { name: /Cliente 2/ }), 1300)
    await say(p, 'A ficha mostra o histórico e o total gasto')
    await glide(p, p.getByRole('heading', { name: 'Crédito do cliente' }))
    await say(p, 'Aqui você ajusta o crédito do cliente')
    await glide(p, p.getByRole('heading', { name: 'Últimos agendamentos' }))
    await say(p, 'E vê os últimos agendamentos')
    await pause(p, 1200)
  },
})

docVideo({
  slug: 'servicos', title: 'Serviços e Categorias',
  open: async (p, { base }) => {
    await p.goto(`${base}/servicos`)
    await expect(p.getByText('Serviço 1').first()).toBeVisible()
  },
  run: async (p) => {
    await say(p, 'Aqui ficam os serviços, com duração, preço e comissão')
    await tap(p, p.getByRole('button', { name: 'Novo serviço' }), 1000)
    const d = drawer(p)
    await say(p, 'Dê um nome e escolha a categoria')
    await typeQuick(p, field(d, 'Nome do serviço'), 'Serviço 9')
    await pickQuick(p, field(d, 'Categoria').getByRole('button', { name: 'Selecione...' }), 'Categoria 1')
    await say(p, 'Informe duração, preço e a comissão da profissional')
    await field(d, 'Duração (HH:MM)').fill('01:00')
    await typeQuick(p, field(d, 'Preço (R$)'), '100')
    await typeQuick(p, field(d, 'Comissão (%)'), '40')
    await tap(p, d.getByRole('button', { name: 'Salvar' }), 800)
    await p.getByRole('heading', { name: 'Novo serviço' }).waitFor({ state: 'hidden' })
    await say(p, 'Pronto! O serviço já pode ser agendado')
    await glide(p, p.getByRole('row').filter({ hasText: 'Serviço 9' }))
  },
})

docVideo({
  slug: 'pacotes', title: 'Pacotes (Combos)',
  open: async (p, { base }) => {
    await p.goto(`${base}/combos`)
    await expect(p.getByRole('heading', { name: 'Pacote 1' })).toBeVisible()
  },
  run: async (p, { base }) => {
    await say(p, 'Um pacote reúne várias sessões por um preço fechado')
    await glide(p, p.getByRole('heading', { name: 'Pacote 1' }))
    await tap(p, p.getByRole('button', { name: 'Novo pacote' }).first(), 1000)
    const d = drawer(p)
    await say(p, 'Para criar, dê o nome e o preço do pacote')
    await typeQuick(p, field(d, 'Nome do pacote'), 'Pacote 2')
    await typeQuick(p, field(d, 'Preço (R$)'), '400')
    await say(p, 'Depois adicione os serviços, com valor e comissão por sessão')
    await glide(p, field(d, 'Valor/sessão (R$)'))
    await say(p, 'A soma das sessões precisa bater com o preço do pacote')
    await pause(p, 600)
    await p.goto(`${base}/combos?view=vendidos`) // fecha o painel e abre a aba Pacotes vendidos
    await pause(p, 1000)
    await say(p, 'Em Pacotes vendidos você acompanha cada cliente')
  },
})

docVideo({
  slug: 'convidar-profissional', title: 'Convidar profissional',
  prepare: async (page) => {
    const salon = await createSalon(page, 'Salão Exemplo') // salão só deste vídeo (trial, vagas livres)
    await createProfessional(salon.id, 'Profissional 1')
    return { slug: salon.slug }
  },
  open: async (p, { base }) => {
    await p.goto(`${base}/convidar-profissional`)
    await expect(p.getByText(/Trial · 1\/3 profissionais/)).toBeVisible()
  },
  run: async (p) => {
    await say(p, 'Aqui você monta a equipe do salão')
    await glide(p, p.getByText(/Trial · 1\/3 profissionais/))
    await say(p, 'O plano define quantas vagas existem')
    await say(p, 'Para convidar, informe o nome e o email')
    await typeQuick(p, p.getByPlaceholder('Ex: Maria Oliveira'), 'Profissional 2')
    await typeQuick(p, p.getByPlaceholder('maria@exemplo.com'), 'profissional2@exemplo.com')
    await tap(p, p.getByRole('button', { name: 'Enviar convite' }), 900)
    await expect(p.getByText(/Convite enviado para/)).toBeVisible()
    await say(p, 'A pessoa recebe o link, cria a conta e entra na equipe')
    await glide(p, p.getByRole('button', { name: 'Reenviar' }))
    await say(p, 'Enquanto não aceita, você pode reenviar ou cancelar')
    await pause(p, 1200)
  },
})

docVideo({
  slug: 'caixa', title: 'Caixa',
  open: async (p, { base }) => {
    await p.goto(`${base}/caixa`)
    await expect(p.getByRole('button', { name: /Cliente 9/ }).first()).toBeVisible()
  },
  run: async (p) => {
    const painel = p.locator('[data-tour="comanda-painel"]')
    const grupo = p.getByRole('group', { name: 'Formas de pagamento' })
    await say(p, 'No Caixa ficam as comandas em aberto de cada atendimento')
    await tap(p, p.getByRole('button', { name: /Cliente 9/ }).first(), 1300)
    await say(p, 'Escolha a forma de pagamento')
    const sel = grupo.getByLabel('Forma de pagamento 1', { exact: true })
    await glide(p, sel)
    await sel.selectOption('pix')
    await pause(p, 900)
    await say(p, 'E registre o pagamento em um clique')
    await tap(p, painel.getByRole('button', { name: 'Registrar pagamento' }), 700)
    await expect(p.getByText(/^Pagamento registrado/)).toBeVisible()
    await say(p, 'O pagamento também pode ser dividido entre formas')
    await tap(p, p.getByRole('button', { name: /Cliente 10/ }).first(), 1300)
    await glide(p, grupo.getByRole('button', { name: '+ Adicionar forma de pagamento' }))
    await pause(p, 1800)
  },
})

docVideo({
  slug: 'comissoes', title: 'Comissões',
  open: async (p, { base }) => {
    await p.goto(`${base}/comissoes`)
    await expect(p.getByRole('button', { name: 'Todas', exact: true })).toBeVisible()
  },
  run: async (p) => {
    await say(p, 'Cada pagamento gera a comissão da profissional')
    await tap(p, p.getByRole('button', { name: 'Todas', exact: true }), 1000)
    const prof = p.locator('div').filter({ hasText: 'Profissional 1' })
      .filter({ has: p.getByRole('button', { name: 'Pagar todas' }) }).last()
    await glide(p, prof)
    await say(p, 'Para repassar, clique em Pagar todas')
    await tap(p, prof.getByRole('button', { name: 'Pagar todas' }), 900)
    await say(p, 'Escolha como o repasse foi feito e confirme')
    await tap(p, p.getByRole('button', { name: 'Pix', exact: true }), 700)
    await tap(p, p.getByRole('button', { name: 'Confirmar repasse' }), 600)
    await expect(p.getByText(/marcadas? como repassadas?/)).toBeVisible()
    await say(p, 'Tudo fica registrado no histórico de repasses')
    await tap(p, p.getByRole('button', { name: 'Histórico de repasses' }), 900)
  },
})

docVideo({
  slug: 'produtos', title: 'Produtos e Pedidos',
  open: async (p, { base }) => {
    await p.goto(`${base}/produtos`)
    await expect(p.getByRole('heading', { name: 'Produtos', exact: true })).toBeVisible()
  },
  run: async (p, { base }) => {
    await say(p, 'Em Produtos você cadastra o que o salão vende')
    await tap(p, p.getByRole('button', { name: 'Novo produto' }).first(), 900)
    const d = drawer(p)
    await say(p, 'Informe nome, preço e estoque')
    await typeQuick(p, d.getByPlaceholder('Ex: Shampoo Keratina 300ml'), 'Produto 1')
    await typeQuick(p, d.getByPlaceholder('0,00'), '30')
    await typeQuick(p, d.getByPlaceholder('0', { exact: true }), '10')
    await tap(p, d.getByRole('button', { name: 'Salvar' }), 900)
    await say(p, 'As vendas são registradas em Pedidos de Produtos')
    await goTo(p, 'Pedidos de Produtos', `${base}/pedidos-produtos`)
    await glide(p, p.getByRole('button', { name: 'Novo pedido' }).first())
    await say(p, 'Escolha o produto e o cliente, e o pagamento é feito no Caixa')
  },
})

docVideo({
  slug: 'meus-servicos-horarios', title: 'Meus serviços e horários',
  open: async (p, { base }) => {
    await p.goto(`${base}/meus-horarios`)
    await expect(p.getByRole('heading', { name: 'Meus horários' })).toBeVisible()
  },
  run: async (p, { base }) => {
    await say(p, 'Em Meus horários você define os dias e horas em que atende')
    await tap(p, p.getByRole('button', { name: 'Adicionar' }).nth(1), 1000)
    await say(p, 'Escolha o início, o fim e, se quiser, o intervalo')
    await pause(p, 1500)
    await tap(p, drawer(p).getByRole('button', { name: 'Salvar' }), 900)
    await say(p, 'Os dias sem horário aparecem como folga')
    await goTo(p, 'Meus serviços', `${base}/meus-servicos`)
    await say(p, 'Em Meus serviços ficam os serviços que você realiza')
    await say(p, 'Quem vincula os serviços é o administrador')
    await pause(p, 1500)
  },
})

docVideo({
  slug: 'notificacoes', title: 'Notificações',
  open: async (p, { base }) => {
    await p.goto(base)
    await expect(p.getByRole('button', { name: 'Notificações' })).toBeVisible()
  },
  run: async (p) => {
    await say(p, 'O sino avisa o que precisa da sua atenção')
    await glide(p, p.getByRole('button', { name: 'Notificações' }))
    await say(p, 'Clique nele para abrir a lista de avisos')
    await tap(p, p.getByRole('button', { name: 'Notificações' }), 1500)
    await say(p, 'Aqui aparecem novos agendamentos, cancelamentos e alertas do salão')
    await pause(p, 2500)
  },
})

docVideo({
  slug: 'perfil', title: 'Meu perfil',
  open: async (p, { slug }) => {
    await p.goto(`/${slug}/perfil`)
    await expect(p.getByRole('heading', { name: 'Meu perfil' })).toBeVisible()
  },
  run: async (p) => {
    await say(p, 'Em Meu perfil ficam os seus dados pessoais')
    await tap(p, p.getByRole('button', { name: 'Editar' }), 1100)
    await say(p, 'Edite o nome e a data de nascimento')
    await glide(p, p.getByRole('button', { name: 'Alterar' }))
    await say(p, 'O telefone é o seu login: a troca é confirmada pelo WhatsApp')
    await tap(p, p.getByRole('button', { name: 'Cancelar' }), 900)
    await glide(p, p.getByRole('button', { name: 'Trocar senha' }))
    await say(p, 'Aqui você troca a senha')
    await glide(p, p.getByRole('button', { name: 'Exportar meus dados' }))
    await say(p, 'E exporta uma cópia dos seus dados')
    await pause(p, 1200)
  },
})
