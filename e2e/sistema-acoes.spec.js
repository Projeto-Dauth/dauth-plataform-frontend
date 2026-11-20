import { test, expect } from '@playwright/test'
import { E2E_SUPERADMIN } from '../../backend/e2e/testEnv.js'
import { totpCode } from '../../backend/e2e/mfaTestHelpers.js'
import { loginAsSystem, unlockSystemSessions, enrollSystemMfa, systemGet, systemWrite } from './support/system.js'
import { newUserPage } from './support/browser.js'
import { createOwner } from './support/accounts.js'
import { createSalon, setPaidPlan } from './support/salon.js'
import prisma from './support/db.js'

// Ações do painel /sistema que alteram salões: validação, regra de cada ação, auditoria (antes/depois e motivo),
// isolamento (só a dona do sistema) e a tela. O MFA em si está em sistema-mfa.spec.js.
const DAY = 86_400_000
const REASON = 'Pedido do dono por WhatsApp'

async function newSalon(browser, label) {
  const ownerPage = await newUserPage(browser)
  await createOwner(ownerPage, `Dono ${label} ${Date.now()}`)
  const salon = await createSalon(ownerPage, `Salão ${label} ${Date.now()}`)
  return { salon, ownerPage }
}

const act = (page, salonId, method, path, data) => systemWrite(page, method, `/system/salons/${salonId}${path}`, data)
const row = (id) => prisma.salon.findUnique({ where: { id } })
const audits = (salonId) => prisma.systemAuditLog.findMany({ where: { salonId }, orderBy: { createdAt: 'asc' } })
const days = (date) => (date.getTime() - Date.now()) / DAY

test('dados gerais: edita, valida e registra o antes e o depois', async ({ page, browser }) => {
  const { salon, ownerPage } = await newSalon(browser, 'Edicao')
  await ownerPage.context().close()
  await loginAsSystem(page)

  // Motivo é obrigatório
  expect((await act(page, salon.id, 'PATCH', '', { name: 'Sem Motivo' })).status()).toBe(422)
  expect((await act(page, salon.id, 'PATCH', '', { name: 'Sem Motivo', reason: 'abc' })).status()).toBe(422)

  const novo = `${salon.name} Editado`
  const ok = await act(page, salon.id, 'PATCH', '', { name: novo, phone: '(11) 90000-1234', timezone: 'America/Manaus', reason: REASON })
  expect(ok.status()).toBe(200)
  expect(await row(salon.id)).toMatchObject({ name: novo, phone: '(11) 90000-1234', timezone: 'America/Manaus', slug: salon.slug })

  const [log] = await audits(salon.id)
  expect(log).toMatchObject({ action: 'salon.edit', reason: REASON, salonName: salon.name })
  expect(log.before).toEqual({ name: salon.name, phone: null, timezone: 'America/Sao_Paulo' })
  expect(log.after).toEqual({ name: novo, phone: '(11) 90000-1234', timezone: 'America/Manaus' })

  // Recusas não alteram nada nem deixam registro
  expect((await act(page, salon.id, 'PATCH', '', { name: novo, reason: REASON })).status()).toBe(422) // nada mudou
  expect((await act(page, salon.id, 'PATCH', '', { name: 'a', reason: REASON })).status()).toBe(422)
  expect((await act(page, salon.id, 'PATCH', '', { timezone: 'Marte/Olympus', reason: REASON })).status()).toBe(422)
  expect((await act(page, salon.id, 'PATCH', '', { name: 'x'.repeat(81), reason: REASON })).status()).toBe(422)
  expect(await audits(salon.id)).toHaveLength(1)
})

test('plano: define sem cobrança, mantém o vencimento em dia e valida a data', async ({ page, browser }) => {
  const { salon, ownerPage } = await newSalon(browser, 'Plano')
  await ownerPage.context().close()
  await loginAsSystem(page)

  expect((await act(page, salon.id, 'POST', '/plan', { plan: 'ouro', months: 1, reason: REASON })).status()).toBe(422)
  expect((await act(page, salon.id, 'POST', '/plan', { plan: 'business', months: 2, reason: REASON })).status()).toBe(422)
  const past = new Date(Date.now() - DAY).toISOString().slice(0, 10)
  expect((await act(page, salon.id, 'POST', '/plan', { plan: 'business', months: 1, endsAt: past, reason: REASON })).status()).toBe(422)
  const far = new Date(Date.now() + 400 * DAY).toISOString().slice(0, 10)
  expect((await act(page, salon.id, 'POST', '/plan', { plan: 'business', months: 1, endsAt: far, reason: REASON })).status()).toBe(422)

  expect((await act(page, salon.id, 'POST', '/plan', { plan: 'profissional', months: 3, reason: REASON })).status()).toBe(200)
  const first = await row(salon.id)
  expect(first).toMatchObject({ status: 'active', plan: 'profissional', billingMonths: 3, cancelAtPeriodEnd: false })
  expect(days(first.planEndsAt)).toBeGreaterThan(89)
  expect(days(first.planEndsAt)).toBeLessThan(91)

  // Já em dia: trocar o plano mantém o vencimento
  expect((await act(page, salon.id, 'POST', '/plan', { plan: 'business', months: 1, reason: REASON })).status()).toBe(200)
  const second = await row(salon.id)
  expect(second.plan).toBe('business')
  expect(second.planEndsAt.getTime()).toBe(first.planEndsAt.getTime())

  // Com data: vale a data
  const endsAt = new Date(Date.now() + 45 * DAY).toISOString().slice(0, 10)
  expect((await act(page, salon.id, 'POST', '/plan', { plan: 'essencial', months: 1, endsAt, reason: REASON })).status()).toBe(200)
  const third = await row(salon.id)
  expect(days(third.planEndsAt)).toBeGreaterThan(44.5) // vale até o fim do dia (Brasília) pedido
  expect(days(third.planEndsAt)).toBeLessThan(47)

  const logs = await audits(salon.id)
  expect(logs.map(l => l.action)).toEqual(['salon.plan', 'salon.plan', 'salon.plan'])
  expect(logs[1].before).toMatchObject({ plan: 'profissional' })
  expect(logs[1].after).toMatchObject({ plan: 'business' })
})

test('trial: estende o trial, reabre um trial vencido e recusa salão que já paga', async ({ page, browser }) => {
  const { salon, ownerPage } = await newSalon(browser, 'Trial')
  await ownerPage.context().close()
  await loginAsSystem(page)
  const before = await row(salon.id)

  expect((await act(page, salon.id, 'POST', '/trial', { days: 0, reason: REASON })).status()).toBe(422)
  expect((await act(page, salon.id, 'POST', '/trial', { days: 61, reason: REASON })).status()).toBe(422)
  expect((await act(page, salon.id, 'POST', '/trial', { days: 10, reason: REASON })).status()).toBe(200)
  const extended = await row(salon.id)
  expect(extended.status).toBe('trial')
  expect(Math.round((extended.trialEndsAt - before.trialEndsAt) / DAY)).toBe(10)

  // Trial vencido e suspenso: reabre a partir de hoje
  await prisma.salon.update({ where: { id: salon.id }, data: { status: 'suspended', trialEndsAt: new Date(Date.now() - 3 * DAY) } })
  expect((await act(page, salon.id, 'POST', '/trial', { days: 5, reason: REASON })).status()).toBe(200)
  const reopened = await row(salon.id)
  expect(reopened.status).toBe('trial')
  expect(days(reopened.trialEndsAt)).toBeGreaterThan(4)
  expect(days(reopened.trialEndsAt)).toBeLessThan(6)

  // Salão que paga não tem trial para estender
  await setPaidPlan(salon.id, 'profissional')
  expect((await act(page, salon.id, 'POST', '/trial', { days: 5, reason: REASON })).status()).toBe(409)
})

test('suspender e reativar: reativa pelo período que ainda vale; vencido pede plano ou trial', async ({ page, browser }) => {
  const { salon, ownerPage } = await newSalon(browser, 'Suspensao')
  await ownerPage.context().close()
  await loginAsSystem(page)

  expect((await act(page, salon.id, 'POST', '/reactivate', { reason: REASON })).status()).toBe(409) // não está suspenso
  expect((await act(page, salon.id, 'POST', '/suspend', { reason: REASON })).status()).toBe(200)
  expect((await row(salon.id)).status).toBe('suspended')
  expect((await act(page, salon.id, 'POST', '/suspend', { reason: REASON })).status()).toBe(409) // já suspenso

  expect((await act(page, salon.id, 'POST', '/reactivate', { reason: REASON })).status()).toBe(200)
  expect((await row(salon.id)).status).toBe('trial') // trial ainda em curso

  // Pago e em dia volta como ativo
  await setPaidPlan(salon.id, 'business')
  await act(page, salon.id, 'POST', '/suspend', { reason: REASON })
  await act(page, salon.id, 'POST', '/reactivate', { reason: REASON })
  expect((await row(salon.id)).status).toBe('active')

  // Período vencido: não dá para "reativar" um salão que não tem mais direito
  await prisma.salon.update({ where: { id: salon.id }, data: { status: 'suspended', planEndsAt: new Date(Date.now() - DAY) } })
  const res = await act(page, salon.id, 'POST', '/reactivate', { reason: REASON })
  expect(res.status()).toBe(409)
  expect((await row(salon.id)).status).toBe('suspended')
})

test('arquivar e desarquivar', async ({ page, browser }) => {
  const { salon, ownerPage } = await newSalon(browser, 'Arquivo')
  await ownerPage.context().close()
  await loginAsSystem(page)

  expect((await act(page, salon.id, 'POST', '/unarchive', { reason: REASON })).status()).toBe(409)
  expect((await act(page, salon.id, 'POST', '/archive', { reason: REASON })).status()).toBe(200)
  expect((await row(salon.id)).archivedAt).not.toBeNull()
  expect((await act(page, salon.id, 'POST', '/archive', { reason: REASON })).status()).toBe(409)
  expect((await act(page, salon.id, 'POST', '/unarchive', { reason: REASON })).status()).toBe(200)
  expect((await row(salon.id)).archivedAt).toBeNull()
})

test('exclusão: exige digitar o slug, agenda 30 dias, bloqueia mudança de plano e dá para cancelar', async ({ page, browser }) => {
  const { salon, ownerPage } = await newSalon(browser, 'Exclusao')
  await ownerPage.context().close()
  await loginAsSystem(page)

  expect((await act(page, salon.id, 'POST', '/schedule-deletion', { reason: REASON })).status()).toBe(422)
  expect((await act(page, salon.id, 'POST', '/schedule-deletion', { confirm: 'outro-slug', reason: REASON })).status()).toBe(422)
  expect((await row(salon.id)).scheduledDeletionAt).toBeNull()

  expect((await act(page, salon.id, 'POST', '/schedule-deletion', { confirm: salon.slug, reason: REASON })).status()).toBe(200)
  const scheduled = await row(salon.id)
  expect(scheduled.active).toBe(false)
  expect(days(scheduled.scheduledDeletionAt)).toBeGreaterThan(29)
  expect(days(scheduled.scheduledDeletionAt)).toBeLessThan(31)

  expect((await act(page, salon.id, 'POST', '/schedule-deletion', { confirm: salon.slug, reason: REASON })).status()).toBe(409)
  expect((await act(page, salon.id, 'POST', '/plan', { plan: 'business', months: 1, reason: REASON })).status()).toBe(409)

  expect((await act(page, salon.id, 'POST', '/cancel-deletion', { reason: REASON })).status()).toBe(200)
  expect(await row(salon.id)).toMatchObject({ active: true, scheduledDeletionAt: null })
  expect((await act(page, salon.id, 'POST', '/cancel-deletion', { reason: REASON })).status()).toBe(409)

  // O registro sobrevive à exclusão do salão (sem FK) e guarda o nome da época
  const logs = await audits(salon.id)
  expect(logs.map(l => l.action)).toEqual(['salon.schedule_deletion', 'salon.cancel_deletion'])
  expect(logs[0].salonName).toBe(salon.name)
})

test('salão que não existe: 404 e nada gravado', async ({ page }) => {
  await loginAsSystem(page)
  const before = await prisma.systemAuditLog.count()
  expect((await act(page, 'nao-existe', 'POST', '/suspend', { reason: REASON })).status()).toBe(404)
  expect((await act(page, 'nao-existe', 'PATCH', '', { name: 'Fantasma', reason: REASON })).status()).toBe(404)
  expect(await prisma.systemAuditLog.count()).toBe(before)
})

test('o dono do salão (Admin) não altera nada pelo painel: 404 e o salão fica como estava', async ({ browser }) => {
  const { salon, ownerPage } = await newSalon(browser, 'Isolamento')
  for (const [method, path, data] of [
    ['PATCH', '', { name: 'Invadido', reason: REASON }],
    ['POST', '/suspend', { reason: REASON }],
    ['POST', '/plan', { plan: 'business', months: 6, reason: REASON }],
    ['POST', '/schedule-deletion', { confirm: salon.slug, reason: REASON }],
  ]) {
    const res = await systemWrite(ownerPage, method, `/system/salons/${salon.id}${path}`, data)
    expect(res.status(), `${method} ${path} pelo dono`).toBe(404)
  }
  expect(await row(salon.id)).toMatchObject({ name: salon.name, status: 'trial', plan: null, scheduledDeletionAt: null })
  expect(await audits(salon.id)).toHaveLength(0)
  await ownerPage.context().close()
})

test('GET /system/audit lista as ações, da mais nova para a mais antiga, com o nome de quem fez', async ({ page, browser }) => {
  const { salon, ownerPage } = await newSalon(browser, 'Auditoria')
  await ownerPage.context().close()
  await loginAsSystem(page)
  await act(page, salon.id, 'POST', '/archive', { reason: 'primeiro motivo' })
  await act(page, salon.id, 'POST', '/unarchive', { reason: 'segundo motivo' })

  const { data, total } = await systemGet(page, '/system/audit', { salonId: salon.id })
  expect(total).toBe(2)
  expect(data.map(r => r.action)).toEqual(['salon.unarchive', 'salon.archive'])
  expect(data[0]).toMatchObject({ reason: 'segundo motivo', userName: E2E_SUPERADMIN.name, salonName: salon.name })
  expect(data[0]).not.toHaveProperty('userAgent')
})

test('tela: suspender pelo detalhe, com motivo, e ver na aba Auditoria', async ({ page, browser }) => {
  const { salon, ownerPage } = await newSalon(browser, 'Tela')
  await ownerPage.context().close()
  await loginAsSystem(page)

  await page.goto('/sistema?tab=saloes')
  await page.getByLabel('Buscar salão').fill(salon.name)
  await page.getByRole('button', { name: `Ver ${salon.name}` }).click()
  const panel = page.getByRole('dialog', { name: salon.name })
  await panel.getByRole('button', { name: 'Suspender' }).click()

  const dialog = page.getByRole('dialog', { name: 'Suspender salão' })
  const confirm = dialog.getByRole('button', { name: 'Suspender' })
  await expect(confirm).toBeDisabled() // sem motivo
  await dialog.getByPlaceholder('Ex.: pedido do dono por WhatsApp').fill('abc')
  await expect(confirm).toBeDisabled() // motivo curto demais
  await dialog.getByPlaceholder('Ex.: pedido do dono por WhatsApp').fill('Inadimplência confirmada pelo financeiro')
  await confirm.click()

  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Salão suspenso com sucesso.')).toBeVisible() // aviso de sucesso (toast)
  await expect(panel.getByText('Suspenso', { exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Reativar' })).toBeVisible()
  expect((await row(salon.id)).status).toBe('suspended')

  // Falha também avisa: suspender de novo um salão já suspenso é recusado e o diálogo fica aberto
  await panel.getByRole('button', { name: 'Reativar' }).click()
  await prisma.salon.update({ where: { id: salon.id }, data: { status: 'trial' } }) // muda por fora: o servidor recusa
  const again = page.getByRole('dialog', { name: 'Reativar salão' })
  await again.getByPlaceholder('Ex.: pedido do dono por WhatsApp').fill('Teste de falha com aviso')
  await again.getByRole('button', { name: 'Reativar' }).click()
  await expect(page.getByText('Falha:', { exact: false }).first()).toBeVisible()
  await expect(again).toBeVisible()
  await again.getByRole('button', { name: 'Cancelar' }).click()
  await prisma.salon.update({ where: { id: salon.id }, data: { status: 'suspended' } })

  await panel.getByRole('button', { name: 'Fechar' }).click()
  await page.getByRole('tab', { name: 'Auditoria' }).click()
  await expect(page.getByText(`Salão suspenso · ${salon.name}`)).toBeVisible()
  await expect(page.getByText('Inadimplência confirmada pelo financeiro')).toBeVisible()
})

test('tela: se o último código passou de 5 min, pede o código antes de alterar e conclui a ação', async ({ page, browser }) => {
  const { salon, ownerPage } = await newSalon(browser, 'StepUp')
  await ownerPage.context().close()
  await loginAsSystem(page)
  const secret = await enrollSystemMfa()
  await unlockSystemSessions(new Date(Date.now() - 10 * 60 * 1000)) // desbloqueado, mas com o código velho

  await page.goto('/sistema?tab=saloes')
  await page.getByLabel('Buscar salão').fill(salon.name)
  await page.getByRole('button', { name: `Ver ${salon.name}` }).click()
  const panel = page.getByRole('dialog', { name: salon.name })
  await panel.getByRole('button', { name: 'Arquivar' }).click()
  const dialog = page.getByRole('dialog', { name: 'Arquivar salão' })
  await dialog.getByPlaceholder('Ex.: pedido do dono por WhatsApp').fill('Salão sem uso há meses')
  await dialog.getByRole('button', { name: 'Arquivar' }).click()

  const stepUp = page.getByRole('dialog', { name: 'Confirmar com o código' })
  await expect(stepUp).toBeVisible()
  expect((await row(salon.id)).archivedAt).toBeNull() // ainda não alterou
  await stepUp.getByPlaceholder('000000').fill('111111')
  await stepUp.getByRole('button', { name: 'Confirmar' }).click()
  await expect(stepUp.getByText('Código inválido.')).toBeVisible()

  await stepUp.getByPlaceholder('000000').fill(totpCode(secret))
  await stepUp.getByRole('button', { name: 'Confirmar' }).click()
  await expect(stepUp).toHaveCount(0)
  await expect(dialog).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Desarquivar' })).toBeVisible()
  await expect.poll(async () => (await row(salon.id)).archivedAt).not.toBeNull()
})
