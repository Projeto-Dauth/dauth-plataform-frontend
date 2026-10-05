import { test, expect } from '@playwright/test'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from './support/session.js'
import { nextWeekday } from './support/dates.js'
import { newUserPage } from './support/browser.js'
import { demoSalon, memberId, serviceId, apiPost, confirmAndConclude } from './support/demo.js'

// Fluxo principal do salão: agendamento → confirmar → concluir (gera comanda) → fechar a conta
// → a comissão aparece para a profissional.
test('concluir e cobrar um atendimento gera a comissão da profissional', async ({ page, browser }) => {
  const salon = await demoSalon()
  await loginAs(page, SEED_USERS.owner)
  const appointment = await apiPost(page, salon.id, '/appointment', {
    Client: await memberId(salon.id, SEED_USERS.cliente),
    Professional: await memberId(salon.id, SEED_USERS.profissional),
    Service: await serviceId(salon.id, 'Escova'),
    Date: nextWeekday().iso,
    Start_time: '15:00',
    End_time: '16:00',
  })

  await confirmAndConclude(page, appointment.UUID)
  await page.getByRole('button', { name: 'Fechar comanda' }).click()
  await page.getByRole('button', { name: /^Fechar conta/ }).click() // forma padrão: primeira aceita (Pix)
  await expect(page.getByText(/^Conta fechada com sucesso/)).toBeVisible()

  // A profissional, na própria conta, vê a comissão a receber
  const ana = await newUserPage(browser)
  await loginAs(ana, SEED_USERS.profissional)
  await ana.goto(`/${SEED_SALON_SLUG}/profissional/comissoes`)
  const row = ana.getByRole('row').filter({ hasText: 'João Cliente' }).filter({ hasText: 'Escova' })
  await expect(row).toBeVisible()
  await expect(row).not.toContainText('Pago no pacote') // cobrado normalmente, não é sessão de pacote
})
