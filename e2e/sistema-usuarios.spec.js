import { test, expect } from '@playwright/test'
import { E2E_API_URL, E2E_SUPERADMIN } from '../../backend/e2e/testEnv.js'
import { loginAsSystem, systemGet, systemWrite } from './support/system.js'
import { loginAs } from './support/session.js'
import { newUserPage } from './support/browser.js'
import { createOwner, createClientAccount } from './support/accounts.js'
import { createSalon } from './support/salon.js'
import prisma from './support/db.js'

// Aba Usuários do painel /sistema: lista, detalhe e ações (encerrar sessões, link de senha, bloquear, anonimizar).
// A autenticação do app NÃO é alterada pelo painel: bloquear e encerrar sessões apagam as sessões e barram o login novo;
// quem já está com a página aberta pode seguir até 5 min (cache de sessão do Better Auth), então os testes conferem o banco
// e o login, não a queda imediata de uma sessão já aberta.
const REASON = 'Pedido do próprio usuário'
const PLATFORM = `${E2E_API_URL}/api/v1`

const idOf = async (account) => (await prisma.user.findFirst({ where: { phone: account.phone }, select: { id: true } })).id
const act = (page, userId, path, data) => systemWrite(page, 'POST', `/system/users/${userId}${path}`, data)
const audits = (targetUserId) => prisma.systemAuditLog.findMany({ where: { targetUserId }, orderBy: { createdAt: 'asc' } })
const loginRes = (page, account) => page.request.post(`${PLATFORM}/auth/login`, { data: { phone: account.phone, password: account.password } })
// Rota da plataforma (requireAuth) e do produto (authorization) com a sessão do `page`
const platformMe = (page) => page.request.get(`${PLATFORM}/platform/me`)
const productMe = (page, salonId) => page.request.get(`${E2E_API_URL}/api/users/perfil/me`, { headers: { 'x-salon-id': salonId } })

async function ownerWithSalon(browser, label) {
  const page = await newUserPage(browser)
  const owner = await createOwner(page, `Dono ${label} ${Date.now()}`)
  const salon = await createSalon(page, `Salão ${label} ${Date.now()}`)
  return { page, owner, salon, id: await idOf(owner) }
}

async function clientLoggedIn(browser, label) {
  const setup = await newUserPage(browser)
  const account = await createClientAccount(setup, `Cliente ${label} ${Date.now()}`)
  await setup.context().close()
  const page = await newUserPage(browser)
  await loginAs(page, account)
  return { page, account, id: await idOf(account) }
}

test('lista e detalhe: busca, filtros por papel e situação, salões, sessões e contato', async ({ page, browser }) => {
  const o = await ownerWithSalon(browser, 'Lista')
  const c = await clientLoggedIn(browser, 'Lista')
  await loginAsSystem(page)

  const byName = await systemGet(page, '/system/users', { search: o.owner.name })
  expect(byName.total).toBe(1)
  expect(byName.data[0]).toMatchObject({ id: o.id, name: o.owner.name, state: 'active', platformRole: 'SalonOwner' })
  expect(byName.data[0].salons).toEqual([{ id: o.salon.id, name: o.salon.name, role: 'Admin' }])
  expect(byName.data[0].sessions).toBeGreaterThanOrEqual(1)
  expect(byName.data[0]).not.toHaveProperty('verificationToken')

  // Cliente de telefone: o email interno (@dauth.internal) não aparece; o telefone sim
  const client = (await systemGet(page, '/system/users', { search: c.account.name })).data[0]
  expect(client).toMatchObject({ id: c.id, phone: c.account.phone, email: null })

  expect((await systemGet(page, '/system/users', { role: 'Admin', search: o.owner.name })).total).toBe(1)
  expect((await systemGet(page, '/system/users', { role: 'Profissional', search: o.owner.name })).total).toBe(0)
  expect((await systemGet(page, '/system/users', { state: 'active', search: o.owner.name })).total).toBe(1)
  expect((await systemGet(page, '/system/users', { state: 'blocked', search: o.owner.name })).total).toBe(0)
  expect((await systemGet(page, '/system/users', { limit: 1, page: 2 })).data).toHaveLength(1)

  const detail = await systemGet(page, `/system/users/${o.id}`)
  expect(detail).toMatchObject({ id: o.id, state: 'active', protected: false })
  expect(detail.salons[0]).toMatchObject({ id: o.salon.id, role: 'Admin', memberActive: true, status: 'trial' })
  expect(detail.sessions.length).toBeGreaterThanOrEqual(1)
  expect(detail.sessions[0]).toHaveProperty('ipAddress')
  // Nunca expõe senha, token ou hash
  expect(JSON.stringify(detail)).not.toMatch(/password|token|hash/i)

  await o.page.context().close()
  await c.page.context().close()
})

test('encerrar sessões apaga os logins e a pessoa entra de novo com a senha', async ({ page, browser }) => {
  const c = await clientLoggedIn(browser, 'Sessao')
  expect((await platformMe(c.page)).status()).toBe(200)
  await loginAsSystem(page)

  expect((await act(page, c.id, '/revoke-sessions', {})).status()).toBe(422) // sem motivo
  const openBefore = await prisma.session.count({ where: { userId: c.id } }) // o cadastro também deixa sessões
  expect(openBefore).toBeGreaterThanOrEqual(1)
  expect((await act(page, c.id, '/revoke-sessions', { reason: REASON })).status()).toBe(200)
  expect(await prisma.session.count({ where: { userId: c.id } })).toBe(0)

  // A conta continua ativa: entra de novo com a senha (a sessão nova é outra)
  expect((await loginRes(c.page, c.account)).status()).toBe(200)
  expect((await platformMe(c.page)).status()).toBe(200)

  const [log] = await audits(c.id)
  expect(log).toMatchObject({ action: 'user.revoke_sessions', reason: REASON })
  expect(log.before).toEqual({ sessions: openBefore })
  expect(log.after).toEqual({ sessions: 0 })
  await c.page.context().close()
})

test('bloquear apaga as sessões, impede o login e dá para desbloquear', async ({ page, browser }) => {
  const o = await ownerWithSalon(browser, 'Bloqueio')
  expect((await platformMe(o.page)).status()).toBe(200)
  expect((await productMe(o.page, o.salon.id)).status()).toBe(200)
  await loginAsSystem(page)

  expect((await act(page, o.id, '/unblock', { reason: REASON })).status()).toBe(409) // não está bloqueada
  expect((await act(page, o.id, '/block', { reason: REASON })).status()).toBe(200)
  expect((await prisma.user.findUnique({ where: { id: o.id } })).active).toBe(false)

  expect(await prisma.session.count({ where: { userId: o.id } })).toBe(0)
  // Login novo barrado (a página que já estava aberta pode seguir até 5 min: cache de sessão, fora do escopo do painel)
  const login = await loginRes(o.page, o.owner)
  expect(login.status()).toBe(403)
  expect((await login.json()).error).toBe('Conta desativada.')

  expect((await systemGet(page, '/system/users', { state: 'blocked', search: o.owner.name })).total).toBe(1)
  expect((await act(page, o.id, '/block', { reason: REASON })).status()).toBe(409) // já bloqueada

  expect((await act(page, o.id, '/unblock', { reason: REASON })).status()).toBe(200)
  expect((await loginRes(o.page, o.owner)).status()).toBe(200)
  expect((await platformMe(o.page)).status()).toBe(200)

  expect((await audits(o.id)).map(l => l.action)).toEqual(['user.block', 'user.unblock'])
  await o.page.context().close()
})

test('link de nova senha: só conta ativa, grava o token e registra', async ({ page, browser }) => {
  const c = await clientLoggedIn(browser, 'Senha')
  await loginAsSystem(page)
  expect((await prisma.user.findUnique({ where: { id: c.id } })).resetToken).toBeNull()

  expect((await act(page, c.id, '/password-reset', { reason: REASON })).status()).toBe(200)
  const after = await prisma.user.findUnique({ where: { id: c.id } })
  expect(after.resetToken).not.toBeNull()
  expect(after.resetExpiresAt.getTime()).toBeGreaterThan(Date.now())
  // A sessão da pessoa não é derrubada, e o token não aparece em lugar nenhum do painel
  expect(await prisma.session.count({ where: { userId: c.id } })).toBeGreaterThanOrEqual(1)
  expect(JSON.stringify(await systemGet(page, `/system/users/${c.id}`))).not.toContain(after.resetToken)

  const [log] = await audits(c.id)
  expect(log).toMatchObject({ action: 'user.password_reset' })
  expect(log.after).toEqual({ linkSent: true })
  expect(JSON.stringify(log)).not.toContain(after.resetToken)

  // Conta pendente de confirmação não recebe o link (e nada é registrado)
  await prisma.user.update({ where: { id: c.id }, data: { verificationToken: `pend-${Date.now()}` } })
  expect((await act(page, c.id, '/password-reset', { reason: REASON })).status()).toBe(409)
  expect(await audits(c.id)).toHaveLength(1)
  await c.page.context().close()
})

test('anonimizar: recusa dono de salão ativo, exige confirmar o contato, apaga os dados e mantém o histórico', async ({ page, browser }) => {
  const o = await ownerWithSalon(browser, 'Anonimiza')
  const c = await clientLoggedIn(browser, 'Anonimiza')
  const clientMember = await prisma.salonMember.create({ data: { salonId: o.salon.id, userId: c.id, role: 'Usuario', phone: c.account.phone } })
  const ownerMember = await prisma.salonMember.findFirst({ where: { salonId: o.salon.id, userId: o.id } })
  const appointment = await prisma.appointment.create({
    data: { salonId: o.salon.id, date: '2030-01-10', startTime: '10:00', endTime: '10:30', clientId: clientMember.id, professionalId: ownerMember.id },
  })
  await loginAsSystem(page)

  // Dono de salão ativo: recusa e diz qual
  const owner = await act(page, o.id, '/anonymize', { confirm: o.owner.phone, reason: REASON })
  expect(owner.status()).toBe(409)
  expect((await owner.json()).error).toContain(o.salon.name)
  expect((await prisma.user.findUnique({ where: { id: o.id } })).name).toBe(o.owner.name)

  // Confirmação errada ou ausente
  expect((await act(page, c.id, '/anonymize', { reason: REASON })).status()).toBe(422)
  expect((await act(page, c.id, '/anonymize', { confirm: '(11) 9 0000-0000', reason: REASON })).status()).toBe(422)
  expect((await prisma.user.findUnique({ where: { id: c.id } })).name).toBe(c.account.name)

  // Confirma com o telefone só em dígitos (a comparação ignora pontuação)
  const ok = await act(page, c.id, '/anonymize', { confirm: c.account.phone.replace(/\D/g, ''), reason: REASON })
  expect(ok.status()).toBe(200)

  const user = await prisma.user.findUnique({ where: { id: c.id } })
  expect(user).toMatchObject({ name: 'Conta anonimizada', phone: null, birthday: null, active: false, resetToken: null, verificationToken: null })
  expect(user.email).toBe(`${c.id}@anonimizado.invalid`)
  expect(await prisma.account.count({ where: { userId: c.id } })).toBe(0) // sem senha: não há como entrar
  expect(await prisma.session.count({ where: { userId: c.id } })).toBe(0)
  expect(await prisma.salonMember.findUnique({ where: { id: clientMember.id } })).toMatchObject({ active: false, phone: null, birthday: null })

  // O login antigo não funciona mais (o telefone não existe e a senha foi apagada)
  expect((await loginRes(c.page, c.account)).status()).toBe(401)

  // O histórico fica: o agendamento continua lá, apontando para o vínculo agora sem nome
  expect(await prisma.appointment.findUnique({ where: { id: appointment.id } })).toMatchObject({ clientId: clientMember.id })

  // Auditoria sem dado pessoal; o nome aparece ao vivo (já anonimizado)
  const [log] = await audits(c.id)
  expect(log).toMatchObject({ action: 'user.anonymize', before: { state: 'active' }, after: { state: 'anonymized' } })
  const raw = JSON.stringify(log)
  expect(raw).not.toContain(c.account.name)
  expect(raw).not.toContain(c.account.phone)
  const listed = (await systemGet(page, '/system/audit', { action: 'user.anonymize' })).data.find(r => r.targetUserId === c.id)
  expect(listed.targetUserName).toBe('Conta anonimizada')

  expect((await systemGet(page, '/system/users', { state: 'anonymized', search: 'Conta anonimizada' })).data.some(u => u.id === c.id)).toBe(true)
  expect((await act(page, c.id, '/anonymize', { confirm: c.account.phone, reason: REASON })).status()).toBe(409) // já anonimizada
  expect((await act(page, c.id, '/block', { reason: REASON })).status()).toBe(409)

  // Dono cujo salão já está com exclusão agendada pode ser anonimizado
  await prisma.salon.update({ where: { id: o.salon.id }, data: { scheduledDeletionAt: new Date(Date.now() + 30 * 86_400_000), active: false } })
  expect((await act(page, o.id, '/anonymize', { confirm: o.owner.email, reason: REASON })).status()).toBe(200)

  await o.page.context().close()
  await c.page.context().close()
})

test('proteções: conta dona do painel, usuário inexistente, motivo e quem não é a dona do painel', async ({ page, browser }) => {
  const o = await ownerWithSalon(browser, 'Protecao')
  await loginAsSystem(page)
  const sysId = (await prisma.user.findFirst({ where: { email: E2E_SUPERADMIN.email }, select: { id: true } })).id

  for (const path of ['/block', '/revoke-sessions', '/password-reset']) {
    expect((await act(page, sysId, path, { reason: REASON })).status(), `dona do painel em ${path}`).toBe(409)
  }
  expect((await act(page, sysId, '/anonymize', { confirm: E2E_SUPERADMIN.phone, reason: REASON })).status()).toBe(409)
  expect((await systemGet(page, `/system/users/${sysId}`)).protected).toBe(true)
  expect(await prisma.session.count({ where: { userId: sysId } })).toBeGreaterThanOrEqual(1)

  expect((await act(page, 'nao-existe', '/block', { reason: REASON })).status()).toBe(404)
  expect((await page.request.get(`${PLATFORM}/system/users/nao-existe`)).status()).toBe(404)
  expect((await act(page, o.id, '/block', { reason: 'abc' })).status()).toBe(422)
  expect((await prisma.user.findUnique({ where: { id: o.id } })).active).toBe(true)

  // Dono de salão (Admin) não enxerga nem altera usuários pelo painel
  expect((await o.page.request.get(`${PLATFORM}/system/users`)).status()).toBe(404)
  expect((await act(o.page, o.id, '/block', { reason: REASON })).status()).toBe(404)
  expect((await prisma.user.findUnique({ where: { id: o.id } })).active).toBe(true)
  await o.page.context().close()
})

test('tela: busca o usuário, bloqueia e desbloqueia com motivo e anonimiza digitando o telefone', async ({ page, browser }) => {
  const c = await clientLoggedIn(browser, 'Tela')
  await c.page.context().close()
  await loginAsSystem(page)

  await page.goto('/sistema?tab=usuarios')
  await page.getByLabel('Buscar usuário').fill(c.account.name)
  await page.getByRole('button', { name: `Ver ${c.account.name}` }).click()
  const panel = page.getByRole('dialog', { name: c.account.name })
  await expect(panel.getByText('Ativa', { exact: true })).toBeVisible()
  await expect(panel.getByText(c.account.phone)).toBeVisible()

  await panel.getByRole('button', { name: 'Bloquear' }).click()
  const block = page.getByRole('dialog', { name: 'Bloquear conta' })
  await expect(block.getByRole('button', { name: 'Bloquear' })).toBeDisabled() // sem motivo
  await block.getByPlaceholder('Ex.: pedido do dono por WhatsApp').fill('Uso indevido confirmado')
  await block.getByRole('button', { name: 'Bloquear' }).click()
  await expect(block).toHaveCount(0)
  await expect(panel.getByText('Bloqueada', { exact: true })).toBeVisible()

  await panel.getByRole('button', { name: 'Desbloquear' }).click()
  const unblock = page.getByRole('dialog', { name: 'Desbloquear conta' })
  await unblock.getByPlaceholder('Ex.: pedido do dono por WhatsApp').fill('Foi engano do financeiro')
  await unblock.getByRole('button', { name: 'Desbloquear' }).click()
  await expect(panel.getByText('Ativa', { exact: true })).toBeVisible()

  await panel.getByRole('button', { name: 'Anonimizar' }).click()
  const anon = page.getByRole('dialog', { name: 'Anonimizar conta' })
  await anon.getByPlaceholder('Ex.: pedido do dono por WhatsApp').fill('Pedido de eliminação (LGPD)')
  await expect(anon.getByRole('button', { name: 'Anonimizar' })).toBeDisabled() // falta digitar o contato
  await expect(anon.getByText(`Digite ${c.account.phone} para confirmar`)).toBeVisible()
  await anon.locator('input').fill(c.account.phone)
  await anon.getByRole('button', { name: 'Anonimizar' }).click()
  await expect(anon).toHaveCount(0)
  // O painel passa a se chamar "Conta anonimizada" (o nome foi apagado)
  const anonPanel = page.getByRole('dialog', { name: 'Conta anonimizada' })
  await expect(anonPanel.getByText('Anonimizada', { exact: true })).toBeVisible()
  await expect(anonPanel.getByRole('button', { name: 'Anonimizar' })).toHaveCount(0)

  // As ações aparecem na aba Auditoria, com a conta já anonimizada
  await anonPanel.getByRole('button', { name: 'Fechar' }).click()
  await page.getByRole('tab', { name: 'Auditoria' }).click()
  await expect(page.getByText('Conta anonimizada · Conta anonimizada').first()).toBeVisible()
  await expect(page.getByText('Pedido de eliminação (LGPD)')).toBeVisible()
})
