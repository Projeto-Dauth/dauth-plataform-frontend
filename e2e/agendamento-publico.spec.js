import { test, expect } from '@playwright/test'
import { SEED_USERS, SEED_SALON_SLUG } from './support/session.js'
import { nextWeekday } from './support/dates.js'

// Fluxo: cliente agenda pelo link público do salão, entra na conta no meio do fluxo e vê o
// agendamento na área dele.
test('cliente agenda pelo link público e vê o agendamento na área do cliente', async ({ page }) => {
  const continuar = page.getByRole('button', { name: 'Continuar' })
  await page.goto(`/${SEED_SALON_SLUG}/agendar`)

  // 1. Serviço
  await page.getByRole('button', { name: /Corte Feminino/ }).click()
  await continuar.click()

  // 2. Profissional
  await page.getByRole('button', { name: /Ana Profissional/ }).click()
  await continuar.click()

  // 3. Data e hora
  const { day, monthChanged } = nextWeekday()
  if (monthChanged) await page.getByRole('button', { name: 'Próximo mês' }).click()
  await page.getByRole('button', { name: String(day), exact: true }).click()
  await page.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first().click()
  await continuar.click()

  // 4. Seus dados — entra com a conta existente
  const { phone, password } = SEED_USERS.cliente
  const loginForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Entrar' }) })
  await loginForm.getByPlaceholder('(11) 9 8765-4321').fill(phone)
  await loginForm.getByPlaceholder('Sua senha').fill(password)
  await loginForm.getByRole('button', { name: 'Entrar' }).click()

  // 5. Confirmar
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click()
  await expect(page.getByRole('heading', { name: 'Agendamento confirmado!' })).toBeVisible()

  // O agendamento aparece na área do cliente
  await page.getByRole('button', { name: 'Ver meus agendamentos' }).click()
  await expect(page).toHaveURL(new RegExp(`/${SEED_SALON_SLUG}/cliente$`))
  await expect(page.getByText('Corte Feminino').first()).toBeVisible()
})
