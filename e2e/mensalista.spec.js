import { test, expect } from '@playwright/test'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from './support/session.js'
import { nextWeekday } from './support/dates.js'
import { newUserPage } from './support/browser.js'
import { demoSalon, memberId, serviceId, apiPost, confirmAndConclude, createClient } from './support/demo.js'
import { createProfessional } from './support/team.js'
import { openTabForNewClient } from './support/caixa.js'
import { createSalon } from './support/salon.js'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import prisma from './support/db.js'

// Fluxo: atendimento fechado como "Mensalista — cobrar depois" → cliente aparece em Mensalistas →
// Admin quita a mensalidade → a comissão aparece para a profissional.
// Serviço próprio do teste, para a linha da comissão não se confundir com a de outros testes.
test('fechar como mensalista, quitar depois e gerar a comissão', async ({ page, browser }) => {
  const salon = await demoSalon()
  const ana = await memberId(salon.id, SEED_USERS.profissional)
  await loginAs(page, SEED_USERS.owner)

  const category = (await prisma.category.findFirst({ where: { salonId: salon.id, name: 'Cabelo' } })).id
  const serviceName = `Serviço Mensalista E2E ${Date.now()}`
  const service = await apiPost(page, salon.id, '/service', { Name: serviceName, Duration: '00:30:00', Commission: 40, Price: 60, Category: category })
  await prisma.serviceProfessional.create({ data: { serviceId: service.UUID, memberId: ana } })
  const appointment = await apiPost(page, salon.id, '/appointment', {
    Client: await memberId(salon.id, SEED_USERS.cliente), Professional: ana, Service: service.UUID,
    Date: nextWeekday(20 * (test.info().repeatEachIndex + test.info().retry)).iso, Start_time: '13:00', End_time: '13:30',
  })

  // Fecha a conta como mensalista
  await confirmAndConclude(page, appointment.UUID)
  await page.getByRole('button', { name: 'Fechar comanda' }).click()
  await page.getByRole('combobox').selectOption('fiado')
  await page.getByRole('button', { name: /^Registrar mensalidade/ }).click()
  await expect(page.getByText(/^Conta fechada com sucesso/)).toBeVisible()

  // Quita em Mensalistas
  await page.goto(`/${SEED_SALON_SLUG}/admin/mensalistas`)
  const card = page.locator('div').filter({ hasText: 'João Cliente' }).filter({ has: page.getByRole('button', { name: 'Quitar' }) }).last()
  await card.getByRole('button', { name: 'Quitar' }).click()
  await page.getByRole('button', { name: 'Pix', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar pagamento' }).click()
  await expect(page.getByText('Mensalidade de João Cliente paga com sucesso!')).toBeVisible()

  // A profissional vê a comissão
  const anaPage = await newUserPage(browser)
  await loginAs(anaPage, SEED_USERS.profissional)
  await anaPage.goto(`/${SEED_SALON_SLUG}/profissional/comissoes`)
  await expect(anaPage.getByRole('row').filter({ hasText: 'João Cliente' }).filter({ hasText: serviceName })).toBeVisible()
})

// Mensalista com assistente: a comissão da assistente só fica "paga" quando o fiado é quitado,
// junto com a da profissional.
test('mensalista com assistente: a comissão da assistente acompanha a quitação do fiado', async ({ page }) => {
  const salon = await demoSalon()
  await loginAs(page, SEED_USERS.owner)
  const ana = await memberId(salon.id, SEED_USERS.profissional)
  const assistant = await createProfessional(salon.id)
  const clientName = `Mensalista Assistente ${Date.now()}`
  const client = await createClient(salon.id, clientName)

  const { data: [appt] } = await apiPost(page, salon.id, '/appointment/batch', {
    Client: client, Date: nextWeekday(30 + 20 * (test.info().repeatEachIndex + test.info().retry)).iso,
    Items: [{ Professional: ana, Service: await serviceId(salon.id, 'Corte Masculino'), Start_time: '16:00', End_time: '16:30', Assistant: assistant.id, Assistant_commission: 10 }],
  })
  for (const Status of ['confirmado', 'concluido']) await apiPost(page, salon.id, `/appointment/${appt.UUID}`, { Status }, 'patch')
  const tab = await prisma.tab.findFirst({ where: { appointmentId: appt.UUID } })
  await apiPost(page, salon.id, '/tab/batch-pay', {
    tab_ids: [tab.id], client_id: client, Payment_date: new Date().toISOString(), Payments: [{ Method: 'fiado', Amount: tab.value }],
  })
  const assistantLine = () => prisma.transaction.findFirst({ where: { tabId: tab.id, assistantId: assistant.id } })
  expect((await assistantLine()).payment, 'antes de quitar, a comissão da assistente fica pendente').toBe(false)

  await page.goto(`/${SEED_SALON_SLUG}/admin/mensalistas`)
  const card = page.locator('div').filter({ hasText: clientName }).filter({ has: page.getByRole('button', { name: 'Quitar' }) }).last()
  await card.getByRole('button', { name: 'Quitar' }).click()
  await page.getByRole('button', { name: 'Pix', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar pagamento' }).click()
  await expect(page.getByText(`Mensalidade de ${clientName} paga com sucesso!`)).toBeVisible()

  const line = await assistantLine()
  expect({ payment: line.payment, commission: line.commissionAmount }).toEqual({ payment: true, commission: 4.5 })
})

// Quitação de mensalidade (POST /transaction/fiado-settle) — casos de borda pela API.
const settle = (page, salonId, { client, clientName, txs }) => page.request.post(`${E2E_API_URL}/api/transaction/fiado-settle`, {
  headers: { 'x-salon-id': salonId },
  data: { client_id: client, client_name: clientName, transaction_ids: txs.map(t => t.id), settlement_method: 'pix', total_amount: 0 },
})

async function fiadoTab(page, salon, base) {
  const tab = await openTabForNewClient(page, salon, { day: nextWeekday(base + 20 * (test.info().repeatEachIndex + test.info().retry)).iso, start: '17:00', end: '17:30' })
  await apiPost(page, salon.id, '/tab/batch-pay', {
    tab_ids: [tab.tabId], client_id: tab.client, Payment_date: new Date().toISOString(), Payments: [{ Method: 'fiado', Amount: 45 }],
  })
  const txs = await prisma.transaction.findMany({ where: { tabId: tab.tabId, method: 'fiado' } })
  return { ...tab, txs }
}

test('borda: quitar a mesma mensalidade duas vezes (ao mesmo tempo ou depois) registra uma quitação só', async ({ page }) => {
  const salon = await demoSalon()
  await loginAs(page, SEED_USERS.owner)
  const f = await fiadoTab(page, salon, 33)

  const results = await Promise.all([settle(page, salon.id, f), settle(page, salon.id, f)])
  expect(results.filter(r => r.ok()).length, 'só um dos dois pedidos simultâneos passa').toBe(1)

  const again = await settle(page, salon.id, f)
  expect(again.status(), 'quitar de novo depois também é recusado').toBe(409)
  expect(await prisma.fiadoSettlement.count({ where: { clientId: f.client } })).toBe(1)
})

test('borda: só lançamento de mensalista em aberto pode ser quitado', async ({ page }) => {
  const salon = await demoSalon()
  await loginAs(page, SEED_USERS.owner)
  // Comanda paga no Pix: a transação não é fiado
  const tab = await openTabForNewClient(page, salon, { day: nextWeekday(34 + 20 * (test.info().repeatEachIndex + test.info().retry)).iso, start: '17:00', end: '17:30' })
  await apiPost(page, salon.id, '/tab/batch-pay', {
    tab_ids: [tab.tabId], client_id: tab.client, Payment_date: new Date().toISOString(), Payments: [{ Method: 'pix', Amount: 45 }],
  })
  const txs = await prisma.transaction.findMany({ where: { tabId: tab.tabId, assistantId: null } })

  const res = await settle(page, salon.id, { ...tab, txs })
  expect(res.ok()).toBe(false)
  expect(await prisma.fiadoSettlement.count({ where: { clientId: tab.client } })).toBe(0)
})

test('borda: mensalidade de outro salão não pode ser quitada', async ({ page }) => {
  const salon = await demoSalon()
  await loginAs(page, SEED_USERS.owner)
  const other = await createSalon(page)
  const client = await createClient(other.id, `Cliente Outro Salão ${Date.now()}`)
  const foreign = await prisma.transaction.create({
    data: { salonId: other.id, method: 'fiado', grossAmount: 80, netAmount: 80, commissionAmount: 0, payment: false, paymentDate: new Date(), clientId: client },
  })

  const res = await settle(page, salon.id, { client, clientName: 'Cliente Outro Salão', txs: [foreign] })
  expect(res.ok()).toBe(false)
  expect((await prisma.transaction.findUnique({ where: { id: foreign.id } })).payment).toBe(false)
  expect(await prisma.fiadoSettlement.count({ where: { clientId: client } })).toBe(0)
})
