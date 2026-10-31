import { test, expect } from '@playwright/test'
import { applyTestEnv } from '../../backend/e2e/testEnv.js'
import { loginAs, SEED_USERS } from './support/session.js'
import { newUserPage } from './support/browser.js'
import { createOwner } from './support/accounts.js'
import { createSalon, setPaidPlan } from './support/salon.js'
import { createClient } from './support/demo.js'
import { SYSTEM_API, loginAsSystem, systemGet } from './support/system.js'
import prisma from './support/db.js'

// Painel /sistema: só a conta em SUPERADMIN_USER_IDS (no E2E, E2E_SUPERADMIN, criada pelo e2e/server.js).
// Para todo o resto — inclusive sem login — o painel não existe (404 na API e "Página não encontrada" na tela).
// Os erros (log front/back, retenção) estão em sistema-logs.spec.js.
const SYSTEM_ROUTES = ['/system/me', '/system/summary', '/system/salons', '/system/salons/qualquer', '/system/errors', '/system/errors/qualquer']
const DAY = 86_400_000

// Salão próprio do teste, com dono, clientes, profissional, conta de serviço e agendamento recente
async function salonWithData(browser, label) {
  const ownerPage = await newUserPage(browser)
  const ownerName = `Dono ${label} ${Date.now()}`
  await createOwner(ownerPage, ownerName)
  const salon = await createSalon(ownerPage, `Salão ${label} ${Date.now()}`)
  await ownerPage.context().close()

  const client1 = await createClient(salon.id, 'Cliente Painel 1')
  await createClient(salon.id, 'Cliente Painel 2')
  const prof = await createClient(salon.id, 'Profissional Painel')
  await prisma.salonMember.update({ where: { id: prof }, data: { role: 'Profissional' } })
  const service = await createClient(salon.id, 'Notebook do salão')
  await prisma.salonMember.update({ where: { id: service }, data: { role: 'Servico' } })
  await prisma.appointment.create({
    data: { salonId: salon.id, date: '2030-01-10', startTime: '10:00', endTime: '10:30', clientId: client1, professionalId: prof },
  })
  return { ...salon, ownerName }
}

test('toda rota /system passa pela trava do painel', async () => {
  applyTestEnv()
  const { default: router } = await import('../../backend/src/platform/routes/routes.js')
  const { requireSuperAdmin } = await import('../../backend/src/platform/middleware/requireSuperAdmin.js')
  const systemRoutes = router.stack.filter(l => l.route?.path.startsWith('/system'))
  expect(systemRoutes.length).toBeGreaterThanOrEqual(6)
  const unguarded = systemRoutes.filter(l => !l.route.stack.some(s => s.handle === requireSuperAdmin)).map(l => l.route.path)
  expect(unguarded, 'rotas /system sem requireSuperAdmin').toEqual([])
})

test('ninguém além da dona do sistema vê o painel (API e tela)', async ({ page, browser }) => {
  // Sem login: 404, não 401 (a rota não se revela)
  for (const path of SYSTEM_ROUTES) {
    expect((await page.request.get(`${SYSTEM_API}${path}`)).status(), `anônimo em ${path}`).toBe(404)
  }
  await page.goto('/sistema')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()

  // Dono de salão (Admin), profissional e cliente do seed
  for (const user of [SEED_USERS.owner, SEED_USERS.profissional, SEED_USERS.cliente]) {
    const p = await newUserPage(browser)
    await loginAs(p, user)
    for (const path of SYSTEM_ROUTES) {
      expect((await p.request.get(`${SYSTEM_API}${path}`)).status(), `${user.name} em ${path}`).toBe(404)
    }
    await p.goto('/sistema')
    await expect(p.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
    await expect(p.getByRole('tab', { name: 'Salões' })).toHaveCount(0)
    await p.context().close()
  }

  // Mudar o próprio platformRole não dá acesso
  const p = await newUserPage(browser)
  await loginAs(p, SEED_USERS.cliente)
  await p.request.patch(`${SYSTEM_API}/platform/me`, { data: { platformRole: 'SuperAdmin' } })
  expect((await p.request.get(`${SYSTEM_API}/system/me`)).status()).toBe(404)
  await p.context().close()
})

test('cada abertura do painel fica registrada uma vez só e aparece em "Últimos acessos"', async ({ page }) => {
  await loginAsSystem(page)
  const { id } = await systemGet(page, '/system/me')
  // Começa sem acesso recente desta conta (testes anteriores abriram o painel há menos de 1 min)
  await prisma.systemAccessLog.deleteMany({ where: { userId: id } })
  const mine = () => prisma.systemAccessLog.count({ where: { userId: id } })

  // A tela chama /system/me duas vezes no dev (StrictMode): conta como um acesso
  await page.goto('/sistema')
  await expect(page.getByRole('heading', { name: 'Sistema' })).toBeVisible()
  await expect.poll(mine).toBe(1)
  await expect(page.getByText('Últimos acessos a este painel')).toBeVisible()

  // Recarregar logo em seguida também é o mesmo acesso
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Sistema' })).toBeVisible()
  expect(await mine()).toBe(1)

  // Passado 1 min, abrir de novo é um acesso novo
  await prisma.systemAccessLog.updateMany({ where: { userId: id }, data: { createdAt: new Date(Date.now() - 2 * 60 * 1000) } })
  await page.reload()
  await expect.poll(mine).toBe(2)
})

test('Visão geral: contagens, receita mensal, vencimentos e PIX duplicado batem com o banco', async ({ page, browser }) => {
  await loginAsSystem(page)
  const before = await systemGet(page, '/system/summary')

  // Um salão novo em trial (vence em 7 dias) e outro pago no Business mensal vencendo em 3 dias
  const trial = await salonWithData(browser, 'Trial')
  const paid = await salonWithData(browser, 'Pago')
  await setPaidPlan(paid.id, 'business')
  await prisma.salon.update({ where: { id: paid.id }, data: { billingMonths: 1, planEndsAt: new Date(Date.now() + 3 * DAY) } })
  // PIX pago depois de o período já estar pago: duplicado, precisa de reembolso manual
  await prisma.payment.create({
    data: {
      salonId: paid.id, plan: 'business', kind: 'renewal', months: 1, amountCents: 19990, status: 'duplicate',
      cycleKey: `dup-${Date.now()}`, expiresAt: new Date(), paidAt: new Date(), note: `Mensalidade já paga (E2E ${paid.id})`,
    },
  })

  const after = await systemGet(page, '/system/summary')
  expect(after.salons.trial - before.salons.trial).toBe(1)
  expect(after.salons.active - before.salons.active).toBe(1)
  expect(after.salons.newThisMonth - before.salons.newThisMonth).toBe(2)
  expect(after.trialsEnding7d - before.trialsEnding7d).toBe(1)
  expect(after.plansEnding7d - before.plansEnding7d).toBe(1)
  expect(after.mrrCents - before.mrrCents).toBe(19990) // Business mensal
  expect(after.duplicatePayments.some(p => p.salon.id === paid.id && p.amountCents === 19990)).toBeTruthy()

  // Trimestral conta o equivalente mensal (R$ 539,70 / 3 = R$ 179,90)
  await prisma.salon.update({ where: { id: paid.id }, data: { billingMonths: 3 } })
  expect((await systemGet(page, '/system/summary')).mrrCents - before.mrrCents).toBe(17990)

  // Arquivado sai das contagens de status e entra em "arquivados"
  await prisma.salon.update({ where: { id: trial.id }, data: { archivedAt: new Date() } })
  const archived = await systemGet(page, '/system/summary')
  expect(archived.salons.trial).toBe(before.salons.trial)
  expect(archived.salons.archived - before.salons.archived).toBe(1)

  // Tela
  await page.goto('/sistema')
  await expect(page.getByText('Receita mensal (MRR)')).toBeVisible()
  await expect(page.getByText('PIX pago em duplicidade (reembolsar manualmente)')).toBeVisible()
  await expect(page.getByText(paid.name)).toBeVisible()
  await expect(page.getByText(`Mensalidade já paga (E2E ${paid.id})`)).toBeVisible()
})

test('Salões: contagens por salão, busca pelo dono, filtros, ordenação e paginação', async ({ page, browser }) => {
  const salon = await salonWithData(browser, 'Lista')
  await loginAsSystem(page)

  // Contagens do salão (API)
  const { data: [row] } = await systemGet(page, '/system/salons', { search: salon.name })
  expect(row).toMatchObject({
    id: salon.id, situation: 'trial', clients: 2, professionals: 1, professionalLimit: 3, serviceAccounts: 1, appointments30d: 1,
    owner: expect.objectContaining({ name: salon.ownerName }),
  })
  expect(row.daysLeft).toBeGreaterThanOrEqual(6)

  // Busca pelo nome do dono
  const byOwner = await systemGet(page, '/system/salons', { search: salon.ownerName })
  expect(byOwner.data.map(s => s.id)).toEqual([salon.id])

  // Filtro por plano e situação
  await setPaidPlan(salon.id, 'profissional')
  expect((await systemGet(page, '/system/salons', { plan: 'profissional', search: salon.name })).total).toBe(1)
  expect((await systemGet(page, '/system/salons', { plan: 'business', search: salon.name })).total).toBe(0)
  expect((await systemGet(page, '/system/salons', { situation: 'active', search: salon.name })).total).toBe(1)
  expect((await systemGet(page, '/system/salons', { situation: 'trial', search: salon.name })).total).toBe(0)

  // Ordenar por vencimento: o que vence primeiro vem antes
  await prisma.salon.update({ where: { id: salon.id }, data: { planEndsAt: new Date(Date.now() + DAY) } })
  const byExpiry = await systemGet(page, '/system/salons', { situation: 'active', sort: 'expires' })
  const ends = byExpiry.data.map(s => (s.endsAt ? new Date(s.endsAt).getTime() : null))
  const dated = ends.filter(t => t != null)
  expect(dated).toEqual([...dated].sort((a, b) => a - b))
  expect(ends.slice(dated.length).every(t => t == null), 'sem vencimento vai para o fim').toBeTruthy()
  expect(byExpiry.data.map(s => s.id)).toContain(salon.id)

  // Paginação no servidor
  const p1 = await systemGet(page, '/system/salons', { limit: 1, page: 1 })
  const p2 = await systemGet(page, '/system/salons', { limit: 1, page: 2 })
  expect(p1.data).toHaveLength(1)
  expect(p1.total).toBeGreaterThan(1)
  expect(p2.data[0].id).not.toBe(p1.data[0].id)

  // Tela: busca + filtro de situação + arquivado
  await page.goto('/sistema?tab=saloes')
  await page.getByLabel('Buscar salão').fill(salon.name)
  // A busca só vale depois de 300 ms; antes disso a lista ainda tem outros salões
  await expect(page.getByText('1 salão(ões)')).toBeVisible()
  await expect(page.getByRole('button', { name: `Ver ${salon.name}` })).toBeVisible()
  await page.getByLabel('Situação').selectOption('suspended')
  await expect(page.getByText('Nenhum salão encontrado')).toBeVisible()
  await prisma.salon.update({ where: { id: salon.id }, data: { archivedAt: new Date() } })
  await page.getByLabel('Situação').selectOption('archived')
  await expect(page.getByText('1 salão(ões)')).toBeVisible()
  await expect(page.getByRole('row', { name: new RegExp(salon.name) }).getByText('Arquivado')).toBeVisible()
})

test('detalhe do salão: dono, plano, contagens e pagamentos', async ({ page, browser }) => {
  const salon = await salonWithData(browser, 'Detalhe')
  await setPaidPlan(salon.id, 'business')
  await prisma.payment.create({
    data: {
      salonId: salon.id, plan: 'business', kind: 'first', months: 1, amountCents: 19990, status: 'paid',
      cycleKey: 'first', paidCycleKey: `${salon.id}|first`, expiresAt: new Date(), paidAt: new Date(),
    },
  })
  await loginAsSystem(page)

  await page.goto('/sistema?tab=saloes')
  await page.getByLabel('Buscar salão').fill(salon.name)
  await page.getByRole('button', { name: `Ver ${salon.name}` }).click()

  const panel = page.getByRole('dialog', { name: salon.name })
  await expect(panel.getByText(salon.ownerName)).toBeVisible()
  await expect(panel.getByText('Business · mensal', { exact: true })).toBeVisible()
  await expect(panel.getByText('R$ 199,90').first()).toBeVisible()
  await expect(panel.getByText('Primeiro pagamento · Business · mensal')).toBeVisible()
  await expect(panel.getByText(/Pago/)).toBeVisible()
  await expect(panel.getByText('Nenhum erro nos últimos 14 dias.')).toBeVisible()

  await panel.getByRole('button', { name: 'Fechar' }).click()
  await expect(panel).toHaveCount(0)
})

test('no celular a lista de salões vira cartões e o detalhe abre em tela cheia', async ({ page, browser }) => {
  const salon = await salonWithData(browser, 'Celular')
  await page.setViewportSize({ width: 390, height: 844 })
  await loginAsSystem(page)

  await page.goto('/sistema?tab=saloes')
  await page.getByLabel('Buscar salão').fill(salon.name)
  await expect(page.getByRole('table')).toBeHidden()
  const card = page.getByRole('button', { name: `Ver ${salon.name}` })
  await expect(card).toBeVisible()
  await expect(card.getByText('2 clientes · 1/3 profissionais · 1 agend. 30d')).toBeVisible()

  await card.click()
  const panel = page.getByRole('dialog', { name: salon.name })
  await expect(panel).toBeVisible()
  expect((await panel.boundingBox()).width).toBeGreaterThanOrEqual(389)
})
