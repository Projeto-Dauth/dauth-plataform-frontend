import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from './support/session.js'
import { nextWeekday } from './support/dates.js'
import { newUserPage } from './support/browser.js'
import { demoSalon, memberId, apiPost } from './support/demo.js'
import { openTabForNewClient } from './support/caixa.js'
import { createProfessional, paidAttendance } from './support/team.js'
import { createSalon } from './support/salon.js'
import prisma from './support/db.js'

// Editar o item de serviço de uma comanda: trocar a profissional ou a assistente. Regras:
// só o Admin troca; depois da comissão repassada, ninguém edita; as pessoas precisam ser do salão.
const testDay = (base) => nextWeekday(base + 20 * (test.info().repeatEachIndex + test.info().retry)).iso

let salon
test.beforeEach(async ({ page }) => {
  salon = await demoSalon()
  await loginAs(page, SEED_USERS.owner)
})

const editItem = (page, tabId, itemId, data) =>
  page.request.patch(`${E2E_API_URL}/api/tab/${tabId}/items/${itemId}`, { headers: { 'x-salon-id': salon.id }, data })
const serviceItem = (tabId) => prisma.tabItem.findFirst({ where: { tabId, itemType: 'service' } })

test('comanda paga, comissão não repassada: trocar a profissional no Caixa leva a comissão junto', async ({ page }) => {
  const from = await createProfessional(salon.id)
  const to = await createProfessional(salon.id)
  const att = await paidAttendance(page, salon, { professional: from.id, day: testDay(80) })

  await page.goto(`/${SEED_SALON_SLUG}/admin/caixa`)
  await page.getByRole('button', { name: new RegExp(att.clientName) }).filter({ hasText: 'Paga' }).first().click()
  await page.getByTitle('Trocar profissional do item').click()
  await page.getByRole('combobox').filter({ has: page.getByRole('option', { name: to.name }) }).selectOption({ label: to.name })

  await expect.poll(async () => (await prisma.transaction.findUnique({ where: { id: att.tx.id } })).professionalId).toBe(to.id)
  expect((await serviceItem(att.tabId)).professionalId).toBe(to.id)
})

test('borda: depois do repasse da comissão, a comanda não pode mais ser editada', async ({ page }) => {
  const pro = await createProfessional(salon.id)
  const other = await createProfessional(salon.id)
  const att = await paidAttendance(page, salon, { professional: pro.id, day: testDay(81) })
  await apiPost(page, salon.id, '/transaction/commissions/bulk-pay', {
    transaction_ids: [att.tx.id], method: 'pix', professional_id: pro.id, professional_name: pro.name, total_amount: att.tx.commissionAmount,
  })

  const res = await editItem(page, att.tabId, att.itemId, { Professional_id: other.id })
  expect(res.status()).toBe(409)
  expect((await res.json()).error).toMatch(/comissão desta comanda já foi repassada/)
  expect((await prisma.transaction.findUnique({ where: { id: att.tx.id } })).professionalId).toBe(pro.id)
})

test('borda: profissional não define nem troca a assistente do item, mesmo na própria comanda', async ({ page, browser }) => {
  const tab = await openTabForNewClient(page, salon, { day: testDay(82) }) // comanda da Ana, em aberto
  const item = await serviceItem(tab.tabId)
  const assistant = await createProfessional(salon.id)

  const ana = await newUserPage(browser)
  await loginAs(ana, SEED_USERS.profissional)
  const res = await ana.request.patch(`${E2E_API_URL}/api/tab/${tab.tabId}/items/${item.id}`, {
    headers: { 'x-salon-id': salon.id }, data: { Assistant_id: assistant.id },
  })
  expect(res.status()).toBe(403)
  expect((await serviceItem(tab.tabId)).assistantId).toBeNull()
})

test('borda: assistente igual à profissional, ou pessoa de outro salão, é recusada', async ({ page }) => {
  const tab = await openTabForNewClient(page, salon, { day: testDay(83) })
  const item = await serviceItem(tab.tabId)
  const ana = await memberId(salon.id, SEED_USERS.profissional)
  const outsider = await createProfessional((await createSalon(page)).id)

  const cases = {
    'assistente = profissional': { Assistant_id: ana },
    'assistente de outro salão': { Assistant_id: outsider.id },
    'profissional de outro salão': { Professional_id: outsider.id },
  }
  for (const [name, data] of Object.entries(cases)) {
    const res = await editItem(page, tab.tabId, item.id, data)
    expect(res.status(), name).toBe(422)
  }
  const after = await serviceItem(tab.tabId)
  expect({ professional: after.professionalId, assistant: after.assistantId }).toEqual({ professional: ana, assistant: null })
})
