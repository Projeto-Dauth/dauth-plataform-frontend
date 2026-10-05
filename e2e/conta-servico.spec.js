import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, loginAs, loginByUi, uniquePhone } from './support/session.js'
import { newUserPage } from './support/browser.js'
import { createBookingSalon } from './support/bookingSalon.js'
import prisma from './support/db.js'

// Conta de serviço (role Servico): o notebook que fica aberto no salão. Criada pelo Admin com telefone de DDD (00),
// acessa Agenda, Caixa, Clientes e Serviços (ligados/desligados na ficha), nunca o que é de Admin. Admin sempre total.

test.beforeEach(async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
})

const servicePhone = () => {
  const d = `${Date.now()}${Math.floor(Math.random() * 10)}`.slice(-8)
  return `(00) 9 ${d.slice(0, 4)}-${d.slice(4)}`
}

async function createServiceAccount(page, s, name = `Recepção ${Date.now()}`) {
  const account = { name, phone: servicePhone(), password: 'Servico@123' }
  const res = await page.request.post(`${E2E_API_URL}/api/v1/salon/service-accounts`, { headers: { 'x-salon-id': s.salon.id }, data: account })
  expect(res.ok(), await res.text()).toBe(true)
  return { ...account, memberId: (await res.json()).id }
}

async function serviceSession(browser, account) {
  const p = await newUserPage(browser)
  await loginAs(p, account)
  return p
}

test('Admin cria a conta de serviço pela tela; ela entra com o (00) e vê só Agenda, Clientes, Serviços e Caixa', async ({ page, browser }) => {
  const s = await createBookingSalon(page)
  const phone = servicePhone()

  await page.goto(`/${s.salon.slug}/admin/convidar-profissional`)
  await page.getByLabel('Nome da conta de serviço').fill('Notebook Recepção')
  await page.getByLabel('Telefone da conta de serviço').fill(phone)
  await page.getByLabel('Senha da conta de serviço').fill('Servico@123')
  await page.getByRole('button', { name: 'Criar conta de serviço' }).click()
  await expect(page.getByText(`Conta de serviço criada. Login: ${phone}`)).toBeVisible()
  await expect(page.getByText(phone, { exact: true })).toBeVisible()

  const notebook = await newUserPage(browser)
  await loginByUi(notebook, phone, 'Servico@123')
  await expect(notebook).toHaveURL(/\/meus-empregos$/)
  await expect(notebook.getByText('Conta de serviço')).toBeVisible()
  await notebook.getByText(s.salon.name).click()
  await expect(notebook).toHaveURL(new RegExp(`/${s.salon.slug}/admin$`))

  for (const name of ['Agenda', 'Agendamentos', 'Clientes', 'Serviços', 'Caixa']) {
    await expect(notebook.getByRole('link', { name, exact: true }).or(notebook.getByRole('button', { name, exact: true })).first(), name).toBeVisible()
  }
  for (const name of ['Dashboard', 'Comissões', 'Mensalistas', 'Configurações', 'Convidar profissional']) {
    await expect(notebook.getByRole('link', { name, exact: true }), name).toHaveCount(0)
  }
})

test('conta de serviço: o que é de Admin é recusado na tela e na API', async ({ page, browser }) => {
  const s = await createBookingSalon(page)
  const account = await createServiceAccount(page, s)
  const notebook = await serviceSession(browser, account)
  const api = (method, path, data) => notebook.request[method](`${E2E_API_URL}/api${path}`, { headers: { 'x-salon-id': s.salon.id }, data })

  await notebook.goto(`/${s.salon.slug}/admin/comissoes`)
  await expect(notebook).toHaveURL(/nao-autorizado/)
  await notebook.goto(`/${s.salon.slug}/admin/configuracoes`)
  await expect(notebook).toHaveURL(/nao-autorizado/)

  const refused = {
    'comissões': await api('get', '/transaction/all-commissions'),
    'dashboard': await api('get', '/dashboard'),
    'mensalistas': await api('get', '/transaction/fiado-pending'),
    'liberar as próprias permissões': await api('put', `/professional/${account.memberId}/permissions`, { permissions: [{ module: 'Caixa', canView: true, canManage: true }] }),
    'ajuste manual de crédito': await api('post', `/users/${s.joao}/credit-adjustment`, { amount: 50 }),
    'configurações do salão': await notebook.request.get(`${E2E_API_URL}/api/v1/salon/config`, { headers: { 'x-salon-id': s.salon.id } }),
  }
  for (const [name, res] of Object.entries(refused)) expect(res.status(), name).toBe(403)

  // Na ficha do cliente, sem as ações de Admin
  await notebook.goto(`/${s.salon.slug}/admin/usuarios`)
  await notebook.getByPlaceholder('Buscar por nome ou telefone…').fill('João')
  await notebook.getByRole('row', { name: /João/ }).first().click()
  await expect(notebook.getByRole('button', { name: /Editar cliente/ }).first()).toBeVisible()
  for (const name of ['Ajustar crédito', 'Redefinir senha', 'Convidar para a equipe', 'Desativar']) {
    await expect(notebook.getByRole('button', { name, exact: true }), name).toHaveCount(0)
  }

  // O que é dela funciona
  expect((await api('get', '/appointment')).ok(), 'agenda').toBe(true)
  expect((await api('get', '/tab')).ok(), 'caixa').toBe(true)
  expect((await api('get', `/users/${s.joao}/credit-balance`)).ok(), 'saldo de crédito no Caixa').toBe(true)
})

test('serviço criado pela conta de serviço nasce sem comissão e o Admin é avisado', async ({ page, browser }) => {
  const s = await createBookingSalon(page)
  const account = await createServiceAccount(page, s)
  const notebook = await serviceSession(browser, account)
  const category = (await prisma.category.findFirst({ where: { salonId: s.salon.id } })).id

  const res = await notebook.request.post(`${E2E_API_URL}/api/service`, {
    headers: { 'x-salon-id': s.salon.id }, data: { Name: 'Escova Notebook', Duration: '00:40:00', Price: 60, Commission: 50, Category: category },
  })
  expect(res.status()).toBe(201)
  const created = await prisma.service.findFirst({ where: { salonId: s.salon.id, name: 'Escova Notebook' } })
  expect(created.commission, 'a comissão enviada pela conta de serviço é ignorada').toBeNull()

  const list = await (await notebook.request.get(`${E2E_API_URL}/api/service`, { headers: { 'x-salon-id': s.salon.id } })).json()
  expect(list.data.find(x => x.UUID === created.id)).not.toHaveProperty('Commission')

  const owner = await prisma.salonMember.findFirst({ where: { salonId: s.salon.id, role: 'Admin' } })
  expect(await prisma.notification.count({ where: { memberId: owner.id, message: { contains: 'Escova Notebook' } } })).toBe(1)

  await page.goto(`/${s.salon.slug}/admin/servicos`)
  await expect(page.getByRole('row').filter({ hasText: 'Escova Notebook' })).toContainText('Comissão pendente')
})

test('Admin desliga o Caixa na ficha da conta de serviço: some do menu e a API recusa', async ({ page, browser }) => {
  const s = await createBookingSalon(page)
  const account = await createServiceAccount(page, s)

  await page.goto(`/${s.salon.slug}/admin/usuarios`)
  await page.getByPlaceholder('Buscar por nome ou telefone…').fill(account.name)
  await page.getByRole('row', { name: new RegExp(account.name) }).click()
  await expect(page.getByRole('checkbox', { name: 'Comissões: visualizar' }), 'conta de serviço não tem Comissões').toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Caixa: visualizar' }).uncheck()
  await page.getByRole('button', { name: 'Salvar permissões' }).click()
  await expect(page.getByText('Permissões atualizadas com sucesso')).toBeVisible()

  const notebook = await serviceSession(browser, account)
  await notebook.goto(`/${s.salon.slug}/admin`)
  await expect(notebook.getByRole('link', { name: 'Agenda', exact: true })).toBeVisible()
  await expect(notebook.getByRole('button', { name: 'Caixa', exact: true })).toHaveCount(0)
  expect((await notebook.request.get(`${E2E_API_URL}/api/tab`, { headers: { 'x-salon-id': s.salon.id } })).status()).toBe(403)
})

test('Admin sempre tem acesso total: não há permissão de Admin para mudar, e restrição antiga não vale mais', async ({ page, browser }) => {
  const s = await createBookingSalon(page)
  const owner = await prisma.salonMember.findFirst({ where: { salonId: s.salon.id, role: 'Admin' } })

  const res = await page.request.put(`${E2E_API_URL}/api/professional/${owner.id}/permissions`, {
    headers: { 'x-salon-id': s.salon.id }, data: { permissions: [{ module: 'Comissoes', canView: false, canManage: false }] },
  })
  expect(res.status()).toBe(422)

  // Registro antigo de "Admin restrito" no banco: ignorado
  await prisma.professionalPermission.create({ data: { salonId: s.salon.id, memberId: owner.id, module: 'Comissoes', canView: false, canManage: false } })
  expect((await page.request.get(`${E2E_API_URL}/api/transaction/all-commissions`, { headers: { 'x-salon-id': s.salon.id } })).ok()).toBe(true)
  await page.goto(`/${s.salon.slug}/admin`)
  await expect(page.getByRole('link', { name: 'Comissões', exact: true })).toBeVisible()
})

test('o DDD (00) é reservado: recusado no cadastro, na troca de telefone e nos clientes cadastrados pelo salão', async ({ page }) => {
  const s = await createBookingSalon(page)
  const phone = servicePhone()

  const register = await page.request.post(`${E2E_API_URL}/api/v1/auth/register`, { data: { name: 'Pessoa', phone, password: 'Teste@1234', platformRole: 'Cliente' } })
  expect(register.status(), 'cadastro de cliente').toBe(422)
  expect((await register.json()).error).toMatch(/reservado para contas de serviço/)

  expect((await page.request.post(`${E2E_API_URL}/api/v1/platform/me/phone`, { data: { phone } })).status(), 'troca de telefone').toBe(422)

  const byAdmin = await page.request.post(`${E2E_API_URL}/api/auth/register-admin`, { headers: { 'x-salon-id': s.salon.id }, data: { name: 'Cliente Balcão', phone } })
  expect(byAdmin.status(), 'cliente cadastrado pelo salão').toBe(422)
  const edit = await page.request.patch(`${E2E_API_URL}/api/users/${s.joao}`, { headers: { 'x-salon-id': s.salon.id }, data: { Phone: phone } })
  expect(edit.status(), 'editar telefone de cliente').toBe(422)

  expect(await prisma.user.count({ where: { phone } })).toBe(0)
  expect(uniquePhone()).not.toMatch(/^\(00\)/) // os testes nunca geram (00) para pessoas
})
