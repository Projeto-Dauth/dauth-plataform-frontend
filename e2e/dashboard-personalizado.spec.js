import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, loginAs } from './support/session.js'
import { createSalon } from './support/salon.js'
import prisma from './support/db.js'

// Salão próprio já pago no plano indicado (o pagamento tem teste próprio).
async function salonOnPlan(page, plan) {
  const salon = await createSalon(page)
  await prisma.salon.update({ where: { id: salon.id }, data: { status: 'active', plan } })
  return salon
}

const api = (page, salon, path, options = {}) =>
  page.request.fetch(`${E2E_API_URL}/api${path}`, { headers: { 'x-salon-id': salon.id }, ...options })

const iso = (d) => d.toISOString().slice(0, 10)
const today = iso(new Date())
const daysAgo = (n) => iso(new Date(Date.now() - n * 86400000))

const widget = (id, query, extra = {}) => ({ id, type: 'kpi', title: '', query, style: {}, x: 0, y: 0, w: 3, h: 2, ...extra })

// Fluxo: o dono do Business abre "Personalizar", remove e configura widgets, salva (persiste ao recarregar)
// e volta ao dashboard original.
test('Business personaliza o dashboard, salva e volta ao original', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  const salon = await salonOnPlan(page, 'business')
  await page.goto(`/${salon.slug}/admin/dashboard`)

  // Sem layout salvo: dashboard original
  await expect(page.getByRole('heading', { name: 'Ranking de profissionais' })).toBeVisible()
  await page.getByRole('button', { name: 'Personalizar' }).click()

  await expect(page.getByRole('heading', { name: 'Personalizar dashboard' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled() // nada mudou ainda

  await page.getByRole('button', { name: 'Remover Cancelamentos' }).click()
  await page.getByRole('button', { name: 'Configurar Top serviços' }).click()
  await expect(page.getByLabel('Período')).toHaveCount(0) // período é o filtro único do topo, não do widget
  await page.getByLabel('Título').fill('Serviços campeões')
  await page.getByLabel('Tipo de gráfico').getByRole('button', { name: 'Pizza' }).click()
  await expect(page.getByText('Você tem alterações não salvas')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar alterações' }).click()

  // Volta para o dashboard, agora o personalizado
  await expect(page.getByText('Dashboard salvo')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Serviços campeões' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cancelamentos', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Ranking de profissionais' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '30 dias' })).toBeVisible() // mesmo filtro de período do dashboard original

  // Persistiu no servidor
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Serviços campeões' })).toBeVisible()
  const saved = await (await api(page, salon, '/dashboard/layout')).json()
  expect(saved.allowed).toBe(true)
  expect(saved.widgets).toHaveLength(7)
  expect(saved.widgets.find(w => w.title === 'Serviços campeões').type).toBe('pizza')

  // Voltar ao dashboard original apaga o layout
  await page.getByRole('button', { name: 'Personalizar' }).click()
  await page.getByRole('button', { name: 'Voltar ao dashboard original' }).click()
  await page.getByRole('button', { name: 'Voltar ao original' }).click()
  await expect(page.getByText('Dashboard original restaurado')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Ranking de profissionais' })).toBeVisible()
  expect((await (await api(page, salon, '/dashboard/layout')).json()).widgets).toBeNull()
})

// Fluxo: Essencial vê o botão travado (abre o upgrade) e a API recusa salvar e consultar.
test('plano Essencial não personaliza o dashboard (tela e API)', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  const salon = await salonOnPlan(page, 'essencial')
  await page.goto(`/${salon.slug}/admin/dashboard`)

  await expect(page.getByRole('heading', { name: 'Ranking de profissionais' })).toBeVisible() // dashboard original, igual a hoje
  await page.getByRole('button', { name: 'Personalizar' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard personalizável não está no seu plano' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Personalizar dashboard' })).toHaveCount(0)

  const layout = await (await api(page, salon, '/dashboard/layout')).json()
  expect(layout).toMatchObject({ allowed: false, widgets: null })

  const put = await api(page, salon, '/dashboard/layout', { method: 'PUT', data: { widgets: [widget('a', { metric: 'faturamento' })] } })
  expect(put.status()).toBe(403)
  expect((await put.json()).error).toContain('plano Business')
  const data = await api(page, salon, '/dashboard/widget-data', { method: 'POST', data: { metric: 'faturamento', from: daysAgo(6), to: today } })
  expect(data.status()).toBe(403)

  // Layout salvo antes de um downgrade fica guardado, mas o plano atual não o usa
  await prisma.dashboardLayout.create({ data: { salonId: salon.id, widgets: [widget('a', { metric: 'faturamento' })] } })
  expect(await (await api(page, salon, '/dashboard/layout')).json()).toMatchObject({ allowed: false })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Ranking de profissionais' })).toBeVisible()
})

// Fluxo: o servidor só aceita o que está no catálogo, calcula pelo salão certo e não mistura layouts.
test('API do dashboard personalizado valida o catálogo e isola os salões', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  const a = await salonOnPlan(page, 'business')
  const b = await salonOnPlan(page, 'business')

  const range = { from: daysAgo(6), to: today } // o período vem do filtro único da página, não do widget
  const invalid = [
    { metric: 'senha_de_todos', ...range },                              // fora do catálogo
    { metric: 'ticket_medio', dimension: 'profissional', ...range },     // agrupamento que a métrica não tem
    { metric: 'faturamento' },                                           // sem período
    { metric: 'faturamento', from: today, to: daysAgo(6) },              // início depois do fim
    { metric: 'faturamento', from: '2020-01-01', to: '2026-01-01' },     // mais de 366 dias
  ]
  for (const q of invalid) {
    const res = await api(page, a, '/dashboard/widget-data', { method: 'POST', data: q })
    expect(res.status(), JSON.stringify(q)).toBe(422)
  }
  const badLayout = await api(page, a, '/dashboard/layout', { method: 'PUT', data: { widgets: [widget('a', { metric: 'faturamento' }, { type: 'pizza3d' })] } })
  expect(badLayout.status()).toBe(422)

  const ok = await api(page, a, '/dashboard/widget-data', { method: 'POST', data: { metric: 'atendimentos', dimension: 'dia', ...range } })
  expect(ok.status()).toBe(200)
  const body = await ok.json()
  expect(body.data).toHaveLength(7) // dia sem movimento aparece com zero
  expect(body.total).toBe(0)        // salão novo, nada ainda

  // Layout é por salão
  const put = await api(page, a, '/dashboard/layout', { method: 'PUT', data: { widgets: [widget('a', { metric: 'faturamento' })] } })
  expect(put.status()).toBe(200)
  expect((await (await api(page, a, '/dashboard/layout')).json()).widgets).toHaveLength(1)
  expect((await (await api(page, b, '/dashboard/layout')).json()).widgets).toBeNull()
})
