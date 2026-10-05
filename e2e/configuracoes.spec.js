import { test, expect } from '@playwright/test'
import { SEED_USERS, loginAs } from './support/session.js'
import { createSalon } from './support/salon.js'

// Fluxo: Admin desliga o agendamento online nas Configurações e a página pública de agendar
// passa a avisar que está indisponível.
test('desligar o agendamento online bloqueia a página de agendar', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  const salon = await createSalon(page)

  // Antes: a página de agendar funciona
  await page.goto(`/${salon.slug}/agendar`)
  await expect(page.getByRole('heading', { name: 'Qual serviço hoje?' })).toBeVisible()

  await page.goto(`/${salon.slug}/admin/configuracoes`)
  await page.getByRole('tab', { name: 'Agendamento' }).click()
  const toggle = page.getByRole('switch', { name: 'Permitir agendamento online' })
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await toggle.click()
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Todas as alterações estão salvas')).toBeVisible()

  // Depois: a página de agendar avisa que está indisponível
  await page.goto(`/${salon.slug}/agendar`)
  await expect(page.getByRole('heading', { name: 'Agendamento online indisponível' })).toBeVisible()
})
