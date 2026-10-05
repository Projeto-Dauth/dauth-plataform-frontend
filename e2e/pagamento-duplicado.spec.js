import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, loginAs } from './support/session.js'
import { nextWeekday } from './support/dates.js'
import { demoSalon } from './support/demo.js'
import { openTabForNewClient, paymentsOf } from './support/caixa.js'
import prisma from './support/db.js'

// A mesma comanda paga duas vezes (duplo clique, duas abas, internet lenta reenviando) nunca
// pode virar dois pagamentos.
const testDay = (base) => nextWeekday(base + 20 * (test.info().repeatEachIndex + test.info().retry)).iso

let salon
test.beforeEach(async ({ page }) => {
  salon = await demoSalon()
  await loginAs(page, SEED_USERS.owner)
})

const pay = (page, tab) => page.request.post(`${E2E_API_URL}/api/tab/batch-pay`, {
  headers: { 'x-salon-id': salon.id },
  data: { tab_ids: [tab.tabId], client_id: tab.client, Payment_date: new Date().toISOString(), Payments: [{ Method: 'pix', Amount: 45 }] },
})

test('dois pagamentos da mesma comanda ao mesmo tempo: só um passa', async ({ page }) => {
  const tab = await openTabForNewClient(page, salon, { day: testDay(70) })

  const results = await Promise.all([pay(page, tab), pay(page, tab)])
  expect(results.filter(r => r.ok()).length, 'só um dos dois pedidos passa').toBe(1)

  expect((await prisma.tab.findUnique({ where: { id: tab.tabId } })).status).toBe('Paga')
  expect(await paymentsOf(tab.tabId)).toEqual([{ method: 'pix', grossAmount: 45 }])
})

test('pagar de novo uma comanda já paga é recusado e não cria outro pagamento', async ({ page }) => {
  const tab = await openTabForNewClient(page, salon, { day: testDay(71) })
  expect((await pay(page, tab)).ok()).toBe(true)

  const again = await pay(page, tab)
  expect(again.ok()).toBe(false)
  expect(await paymentsOf(tab.tabId)).toEqual([{ method: 'pix', grossAmount: 45 }])
})
