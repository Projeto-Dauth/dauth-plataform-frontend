import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, SEED_SALON_SLUG, loginAs, loginByUi } from './support/session.js'
import { createSalon, joinCodeOf, joinByCode, lookupCode } from './support/salon.js'
import { createClientAccount } from './support/accounts.js'
import { newUserPage } from './support/browser.js'
import { apiPost } from './support/demo.js'
import { createBookingSalon, daysFromToday } from './support/bookingSalon.js'
import prisma from './support/db.js'

// Vínculo com o salão pelo código de acesso (XXXX-XXXX): quem não tem vínculo digita o código em
// "Meus salões", confere o nome do salão e entra. Salão próprio por teste; contas novas de cliente.
// Cada teste que erra código usa uma conta própria: o limite de tentativas erradas é por usuário.

const NOT_FOUND = 'Código inválido ou salão indisponível.'

// Dono logado em `page` + salão novo; devolve também uma conta de cliente nova logada em `client`.
async function setup({ page, browser }) {
  await loginAs(page, SEED_USERS.owner)
  const salon = await createSalon(page, `Salão Código ${Date.now()}`)
  const account = await createClientAccount(page)
  const client = await newUserPage(browser)
  return { salon, account, client }
}

const memberOf = async (salonId, phone) => {
  const user = await prisma.user.findFirst({ where: { phone } })
  return prisma.salonMember.findFirst({ where: { salonId, userId: user.id } })
}

test('sem vínculo: digita o código, confere o salão, confirma e entra; depois o login passa pela lista', async ({ page, browser }) => {
  const { salon, account, client } = await setup({ page, browser })

  await loginByUi(client, account.phone, account.password)
  await expect(client).toHaveURL(/\/meus-saloes$/)
  await expect(client.getByRole('heading', { name: 'Você ainda não tem vínculo com nenhum salão' })).toBeVisible()

  // A máscara aceita minúsculas e sem hífen
  const typed = salon.joinCode.replace('-', '').toLowerCase()
  await client.getByLabel('Código do salão').fill(typed)
  await expect(client.getByLabel('Código do salão')).toHaveValue(salon.joinCode)
  await client.getByRole('button', { name: 'Continuar' }).click()

  // Dupla confirmação: mostra o salão e só vincula depois do "Sim"
  await expect(client.getByText('Este é o salão que você procura?')).toBeVisible()
  await expect(client.getByText(salon.name, { exact: true }).first()).toBeVisible()
  expect(await memberOf(salon.id, account.phone), 'ainda não vinculou').toBeNull()
  await client.getByRole('button', { name: 'Sim, entrar' }).click()
  await expect(client).toHaveURL(new RegExp(`/${salon.slug}/cliente$`))
  expect((await memberOf(salon.id, account.phone)).role).toBe('Usuario')

  // Daqui para frente o login passa pela lista, com o salão e o botão de entrar
  const again = await newUserPage(browser)
  await loginByUi(again, account.phone, account.password)
  await expect(again).toHaveURL(/\/meus-saloes$/)
  await again.getByRole('button', { name: `Entrar em ${salon.name}` }).click()
  await expect(again).toHaveURL(new RegExp(`/${salon.slug}/cliente$`))
})

test('"Não é esse" volta ao campo sem vincular', async ({ page, browser }) => {
  const { salon, account, client } = await setup({ page, browser })

  await loginByUi(client, account.phone, account.password)
  await client.getByLabel('Código do salão').fill(salon.joinCode)
  await client.getByRole('button', { name: 'Continuar' }).click()
  await client.getByRole('button', { name: 'Não é esse' }).click()

  await expect(client.getByLabel('Código do salão')).toBeVisible()
  expect(await memberOf(salon.id, account.phone)).toBeNull()
})

test('código que não existe mostra o erro e não cria vínculo', async ({ page, browser }) => {
  const { account, client } = await setup({ page, browser })

  await loginByUi(client, account.phone, account.password)
  await client.getByLabel('Código do salão').fill('AAAA-AAAA')
  await client.getByRole('button', { name: 'Continuar' }).click()
  await expect(client.getByText(NOT_FOUND)).toBeVisible()

  // Código incompleto nem chega a consultar
  await client.getByLabel('Código do salão').fill('AB')
  await expect(client.getByRole('button', { name: 'Continuar' })).toBeDisabled()
})

test('o código só aparece para o Admin: na tela de Configurações, e nunca para cliente ou profissional', async ({ page, browser }) => {
  const { salon, account, client } = await setup({ page, browser })
  expect(salon.joinCode, 'salão novo já nasce com código').toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
  expect(salon.joinCode, 'sem 0, O, 1 e I').not.toMatch(/[01OI]/)

  await page.goto(`/${salon.slug}/admin/configuracoes`)
  await expect(page.getByLabel('Código de acesso do salão')).toHaveText(salon.joinCode)

  await loginAs(client, account)
  await joinByCode(client, salon.joinCode)
  const config = await client.request.get(`${E2E_API_URL}/api/v1/salon/config`, { headers: { 'x-salon-id': salon.id } })
  expect(config.status(), 'cliente não lê a configuração do salão').toBe(403)
  const raw = salon.joinCode.replace('-', '')
  const mine = await (await client.request.get(`${E2E_API_URL}/api/v1/salon/my`)).text()
  const detail = await (await client.request.get(`${E2E_API_URL}/api/v1/salon`, { headers: { 'x-salon-id': salon.id } })).text()
  expect(mine + detail, 'o código não vaza nas outras respostas').not.toContain(raw)

  // Na tela "Meus salões" o cartão não mostra o código
  await client.goto('/meus-saloes')
  await expect(client.getByRole('button', { name: `Entrar em ${salon.name}` })).toBeVisible()
  await expect(client.getByText(salon.joinCode)).toHaveCount(0)

  // Profissional do seed (Salão Demo): também não vê
  const pro = await newUserPage(browser)
  await loginAs(pro, SEED_USERS.profissional)
  const demo = await prisma.salon.findUnique({ where: { slug: SEED_SALON_SLUG } })
  const proConfig = await pro.request.get(`${E2E_API_URL}/api/v1/salon/config`, { headers: { 'x-salon-id': demo.id } })
  expect(proConfig.status()).toBe(403)
})

test('Admin gera novo código: o antigo deixa de valer e quem já entrou continua vinculado', async ({ page, browser }) => {
  const { salon, account, client } = await setup({ page, browser })
  await loginAs(client, account)
  expect((await joinByCode(client, salon.joinCode)).ok(), 'entrou com o código antigo').toBeTruthy()
  const member = await memberOf(salon.id, account.phone)
  const outsider = await createClientAccount(page)
  const other = await newUserPage(browser)
  await loginAs(other, outsider)

  await page.goto(`/${salon.slug}/admin/configuracoes`)
  await page.getByRole('button', { name: 'Gerar novo código' }).click()
  await expect(page.getByText('O código atual deixa de funcionar')).toBeVisible()
  await page.getByRole('button', { name: 'Gerar novo código' }).last().click()
  await expect(page.getByText('Novo código gerado. O anterior deixou de valer.')).toBeVisible()

  const novo = await joinCodeOf(salon.id)
  expect(novo).not.toBe(salon.joinCode)
  await expect(page.getByLabel('Código de acesso do salão')).toHaveText(novo)

  // Código antigo recusado; o novo funciona; quem já estava continua ativo
  const old = await lookupCode(other, salon.joinCode)
  expect(old.status()).toBe(404)
  expect((await old.json()).error).toBe(NOT_FOUND)
  expect((await lookupCode(other, novo)).status()).toBe(200)
  expect((await memberOf(salon.id, account.phone)).active).toBe(true)
  expect((await memberOf(salon.id, account.phone)).id).toBe(member.id)
})

for (const [label, change] of [
  ['suspenso', { status: 'suspended' }],
  ['aguardando pagamento', { status: 'pending_payment', trialEndsAt: null }],
  ['com o trial vencido', { trialEndsAt: new Date(Date.now() - 60_000) }],
  ['arquivado', { archivedAt: new Date() }],
  ['com exclusão agendada', { scheduledDeletionAt: new Date(), active: false }],
]) {
  test(`salão ${label} não aceita o código`, async ({ page, browser }) => {
    const { salon, account, client } = await setup({ page, browser })
    await loginAs(client, account)

    await prisma.salon.update({ where: { id: salon.id }, data: change })
    const lookup = await lookupCode(client, salon.joinCode)
    expect(lookup.status()).toBe(404)
    expect((await lookup.json()).error).toBe(NOT_FOUND)
    expect((await joinByCode(client, salon.joinCode)).status()).toBe(404)
    expect(await memberOf(salon.id, account.phone), 'nada foi criado').toBeNull()

    // Voltando ao normal, o mesmo código funciona
    await prisma.salon.update({ where: { id: salon.id }, data: { status: 'active', trialEndsAt: null, archivedAt: null, scheduledDeletionAt: null, active: true } })
    expect((await joinByCode(client, salon.joinCode)).status()).toBe(200)
  })
}

test('cliente sai do salão pela lista e volta com o código; agendamento em aberto impede', async ({ page, browser }) => {
  await loginAs(page, SEED_USERS.owner)
  const s = await createBookingSalon(page)
  const account = await createClientAccount(page)
  const client = await newUserPage(browser)
  await loginAs(client, account)
  expect((await joinByCode(client, await joinCodeOf(s.salon.id))).ok()).toBeTruthy()
  const member = await memberOf(s.salon.id, account.phone)

  // Com agendamento futuro em aberto, não sai
  const appt = await apiPost(page, s.salon.id, '/appointment', {
    Client: member.id, Professional: s.pro.id, Service: s.corte, Date: daysFromToday(2), Start_time: '09:00', End_time: '09:30',
  })
  await client.goto('/meus-saloes')
  await client.getByRole('button', { name: 'Sair do salão' }).click()
  await client.getByRole('button', { name: 'Sair do salão' }).last().click()
  await expect(client.getByText('Você tem agendamentos em aberto neste salão.')).toBeVisible()
  expect((await memberOf(s.salon.id, account.phone)).active).toBe(true)

  // Cancelado o agendamento, sai: o salão some e volta o pedido de código
  await prisma.appointment.update({ where: { id: appt.UUID }, data: { status: 'cancelado' } })
  await client.reload()
  await client.getByRole('button', { name: 'Sair do salão' }).click()
  await client.getByRole('button', { name: 'Sair do salão' }).last().click()
  await expect(client.getByRole('heading', { name: 'Você ainda não tem vínculo com nenhum salão' })).toBeVisible()
  expect((await memberOf(s.salon.id, account.phone)).active).toBe(false)

  // Volta com o código: o mesmo vínculo (histórico preservado)
  await client.getByLabel('Código do salão').fill(await joinCodeOf(s.salon.id))
  await client.getByRole('button', { name: 'Continuar' }).click()
  await client.getByRole('button', { name: 'Sim, entrar' }).click()
  await expect(client).toHaveURL(new RegExp(`/${s.salon.slug}/cliente$`))
  const back = await memberOf(s.salon.id, account.phone)
  expect({ id: back.id, active: back.active }).toEqual({ id: member.id, active: true })
})

test('profissional e Admin não saem sozinhos; profissional removido não volta pelo código', async ({ page, browser }) => {
  await loginAs(page, SEED_USERS.owner)
  const demo = await prisma.salon.findUnique({ where: { slug: SEED_SALON_SLUG } })
  const s = await createBookingSalon(page)

  // Admin (dono) nunca sai
  const adminLeave = await page.request.post(`${E2E_API_URL}/api/v1/salon/${s.salon.id}/leave`)
  expect(adminLeave.status()).toBe(403)
  // Usar o código do próprio salão não rebaixa o Admin
  const own = await joinByCode(page, await joinCodeOf(s.salon.id))
  expect((await own.json()).role).toBe('Admin')

  // Profissional (seed): a tela não oferece "Sair do salão" e a API recusa
  const pro = await newUserPage(browser)
  await loginByUi(pro, SEED_USERS.profissional.phone, SEED_USERS.profissional.password)
  await expect(pro.getByRole('button', { name: `Entrar em Salão Demo` })).toBeVisible()
  await expect(pro.getByRole('button', { name: 'Sair do salão' })).toHaveCount(0)
  const proLeave = await pro.request.post(`${E2E_API_URL}/api/v1/salon/${demo.id}/leave`)
  expect(proLeave.status()).toBe(403)

  // Profissional removido pelo Admin não volta por código
  const ana = await prisma.user.findFirst({ where: { phone: SEED_USERS.profissional.phone } })
  const anaMember = await prisma.salonMember.create({ data: { salonId: s.salon.id, userId: ana.id, role: 'Profissional', active: false } })
  const back = await joinByCode(pro, await joinCodeOf(s.salon.id))
  expect(back.status()).toBe(404)
  expect((await prisma.salonMember.findUnique({ where: { id: anaMember.id } })).active).toBe(false)
})

test('cliente troca de salão pelo menu e adiciona outro com o código', async ({ page, browser }) => {
  await loginAs(page, SEED_USERS.owner)
  const a = await createSalon(page, `Salão A ${Date.now()}`)
  const b = await createSalon(page, `Salão B ${Date.now()}`)
  const account = await createClientAccount(page)
  const client = await newUserPage(browser)
  await loginAs(client, account)
  await joinByCode(client, a.joinCode)

  await client.goto(`/${a.slug}/cliente`)
  await client.getByRole('button', { name: 'Trocar salão' }).click()
  await expect(client.getByText('Nenhum outro salão.')).toBeVisible()
  await client.getByRole('button', { name: 'Adicionar com código' }).click()
  await client.getByLabel('Código do salão').fill(b.joinCode)
  await client.getByRole('button', { name: 'Continuar' }).click()
  await expect(client.getByText(b.name, { exact: true }).first()).toBeVisible()
  await client.getByRole('button', { name: 'Sim, entrar' }).click()
  await expect(client).toHaveURL(new RegExp(`/${b.slug}/cliente$`))

  // Agora o menu lista o outro salão, e dá para voltar
  await client.getByRole('button', { name: 'Trocar salão' }).click()
  await client.getByRole('button', { name: new RegExp(a.name) }).click()
  await expect(client).toHaveURL(new RegExp(`/${a.slug}/cliente$`))
})

test('muitas tentativas erradas de código são cortadas (429)', async ({ page, browser }) => {
  const { account, client } = await setup({ page, browser })
  await loginAs(client, account)

  const statuses = []
  for (let i = 0; i < 9; i++) statuses.push((await lookupCode(client, 'ZZZZ-ZZZZ')).status())
  expect(statuses.slice(0, 4), 'as primeiras só dizem que o código não existe').toEqual([404, 404, 404, 404])
  expect(statuses, 'depois do limite, bloqueia').toContain(429)
})

// O menu do cliente diz desde quando a pessoa é cliente do salão (data em que entrou), igual em todas as
// telas da área do cliente (inclusive "Meus combos", que antes tinha um menu próprio e diferente).
test('menu do cliente mostra "Cliente desde <mês de ano>" em todas as telas, e o Admin vê na ficha', async ({ page, browser }) => {
  const { salon, account, client } = await setup({ page, browser })
  await loginAs(client, account)
  await joinByCode(client, salon.joinCode)
  const since = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })

  for (const path of ['cliente', 'cliente/combos', 'cliente/agendamentos', 'cliente/comandas']) {
    await client.goto(`/${salon.slug}/${path}`)
    await expect(client.getByText(`Cliente desde ${since}`).first(), path).toBeVisible()
  }

  await page.goto(`/${salon.slug}/admin/usuarios`)
  await page.getByText(account.name).first().click()
  await expect(page.getByText(`Cliente desde ${since}`).first()).toBeVisible()
})
