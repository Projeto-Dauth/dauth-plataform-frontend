import { test, expect } from '@playwright/test'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from './support/session.js'
import { nextWeekday } from './support/dates.js'
import { newUserPage } from './support/browser.js'
import { demoSalon, memberId, serviceId, apiPost, confirmAndConclude, createClient } from './support/demo.js'

// Fluxo: Admin vende um pacote, registra o pagamento no Caixa, o cliente usa uma sessão
// (atendimento concluído sem cobrança) e a profissional recebe a comissão "pago no pacote".
// Usa Hidratação, serviço que nenhum outro teste agenda, para não consumir o pacote por acidente.
test('vender pacote, pagar no caixa e consumir uma sessão gera comissão', async ({ page, browser }) => {
  const salon = await demoSalon()
  const hidratacao = await serviceId(salon.id, 'Hidratação')
  await loginAs(page, SEED_USERS.owner)
  // Cliente e nome de pacote só deste teste (cliente só pode ter um pacote ativo/pendente por vez)
  const stamp = Date.now()
  const clientName = `Cliente Pacote ${stamp}`
  const client = await createClient(salon.id, clientName)
  const pkgName = `Pacote E2E Hidratação ${stamp}`

  // Preparação: o modelo do pacote (2 sessões de Hidratação)
  const pkg = await apiPost(page, salon.id, '/package', { Name: pkgName, Price: 200 })
  await apiPost(page, salon.id, `/package/${pkg.UUID}/items`, {
    items: [{ Service_id: hidratacao, Quantity: 2, Unit_price: 100, Commission_override: 35 }],
  }, 'put')

  // Venda pela tela
  await page.goto(`/${SEED_SALON_SLUG}/admin/combos`)
  const card = page.locator('div').filter({ has: page.getByRole('heading', { name: pkgName }) })
    .filter({ has: page.getByRole('button', { name: 'Vender' }) }).last()
  await card.getByRole('button', { name: 'Vender' }).click()
  await page.getByRole('button', { name: 'Selecionar cliente…' }).click()
  await page.getByPlaceholder('Buscar…').fill(clientName)
  await page.getByText(clientName, { exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar venda' }).click()
  await expect(page.getByText(/vendido! Registre o pagamento na Caixa/)).toBeVisible()

  // Pagamento da compra no Caixa
  await page.goto(`/${SEED_SALON_SLUG}/admin/caixa`)
  await page.getByRole('button', { name: new RegExp(`Pacote: ${pkgName}`) }).click()
  await page.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(page.getByText(/^Pagamento registrado/)).toBeVisible()

  // Uso de uma sessão: o atendimento concluído é coberto pelo pacote
  const appointment = await apiPost(page, salon.id, '/appointment', {
    Client: client,
    Professional: await memberId(salon.id, SEED_USERS.profissional),
    Service: hidratacao,
    Date: nextWeekday(20 * (test.info().repeatEachIndex + test.info().retry)).iso,
    Start_time: '10:00',
    End_time: '11:30',
  })
  await confirmAndConclude(page, appointment.UUID)

  // A profissional vê a comissão da sessão, marcada como paga no pacote (e não "R$ 0,00")
  const ana = await newUserPage(browser)
  await loginAs(ana, SEED_USERS.profissional)
  await ana.goto(`/${SEED_SALON_SLUG}/profissional/comissoes`)
  const row = ana.getByRole('row').filter({ hasText: clientName }).filter({ hasText: 'Pago no pacote' })
  await expect(row).toBeVisible()
})
