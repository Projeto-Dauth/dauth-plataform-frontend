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

// A página pública do salão não existe na versão beta: a aba continua nas Configurações, mas só
// avisa "Em breve" (sem campos). Instagram, equipe e horário voltam quando a página existir.
test('aba Página pública mostra "Em breve" e não tem campos', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  const salon = await createSalon(page)

  await page.goto(`/${salon.slug}/admin/configuracoes`)
  const tab = page.getByRole('tab', { name: /Página pública/ })
  await expect(tab).toContainText('Em breve')
  await tab.click()
  await expect(page.getByText('Estamos preparando a página pública do salão')).toBeVisible()
  await expect(page.getByLabel('Instagram')).toHaveCount(0)
  await expect(page.getByRole('switch', { name: 'Mostrar equipe' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Salvar alterações' })).toHaveCount(0) // aba sem nada para salvar
})
