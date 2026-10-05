import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, loginAs } from './support/session.js'
import { apiPost } from './support/demo.js'
import { createBookingSalon, daysFromToday } from './support/bookingSalon.js'
import prisma from './support/db.js'

// Formas de pagamento aceitas (Configurações → Pagamentos): o que é desligado some do Caixa e é
// recusado pela API; sempre fica pelo menos uma. Salão próprio por teste.

test.beforeEach(async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
})

async function openPaymentsTab(page, slug) {
  await page.goto(`/${slug}/admin/configuracoes`)
  await page.getByRole('tab', { name: 'Pagamentos' }).click()
}

test('desligar os cartões: somem do Caixa e a API recusa pagamento no cartão', async ({ page }) => {
  const s = await createBookingSalon(page)

  await openPaymentsTab(page, s.salon.slug)
  await page.getByRole('switch', { name: 'Cartão de débito' }).click()
  await page.getByRole('switch', { name: 'Cartão de crédito' }).click()
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Todas as alterações estão salvas')).toBeVisible()

  // Atendimento concluído do João (gera a comanda em aberto)
  const appt = await apiPost(page, s.salon.id, '/appointment', {
    Client: s.joao, Professional: s.pro.id, Service: s.corte, Date: daysFromToday(2), Start_time: '09:00', End_time: '09:30',
  })
  for (const Status of ['confirmado', 'concluido']) await apiPost(page, s.salon.id, `/appointment/${appt.UUID}`, { Status }, 'patch')
  const tab = await prisma.tab.findFirst({ where: { appointmentId: appt.UUID } })

  await page.goto(`/${s.salon.slug}/admin/caixa`)
  await page.getByRole('button', { name: /João Cliente/ }).filter({ hasText: 'Em aberto' }).first().click()
  const method = page.getByRole('group', { name: 'Formas de pagamento' }).getByLabel('Forma de pagamento 1', { exact: true })
  await expect(method.locator('option')).toHaveText(['Pix', 'Dinheiro', 'Mensalista'].map(t => new RegExp(t)))

  const res = await page.request.post(`${E2E_API_URL}/api/tab/batch-pay`, {
    headers: { 'x-salon-id': s.salon.id },
    data: { tab_ids: [tab.id], client_id: s.joao, Payment_date: new Date().toISOString(), Payments: [{ Method: 'cartao_debito', Amount: 50 }] },
  })
  expect(res.status()).toBe(422)
  expect((await res.json()).error).toMatch(/não aceita/)
  expect((await prisma.tab.findUnique({ where: { id: tab.id } })).status).toBe('Em aberto')
})

test('sempre fica pelo menos uma forma de pagamento, na tela e na API', async ({ page }) => {
  const s = await createBookingSalon(page, { paymentMethods: ['pix'] })

  await openPaymentsTab(page, s.salon.slug)
  const pix = page.getByRole('switch', { name: 'Pix' })
  await expect(pix).toHaveAttribute('aria-checked', 'true')
  await pix.click()
  await expect(page.getByText('Mantenha pelo menos uma forma de pagamento.')).toBeVisible()
  await expect(pix).toHaveAttribute('aria-checked', 'true')

  const res = await page.request.patch(`${E2E_API_URL}/api/v1/salon/config`, { headers: { 'x-salon-id': s.salon.id }, data: { paymentMethods: [] } })
  expect(res.ok()).toBe(false)
  expect((await prisma.salon.findUnique({ where: { id: s.salon.id } })).paymentMethods).toBe('pix')
})
