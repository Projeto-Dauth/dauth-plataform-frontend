import { test, expect } from '@playwright/test'
import { createOwner } from './support/accounts.js'
import { createSalon } from './support/salon.js'

// Salão com nome igual a uma rota fixa do front (/sistema, /login, /termos...) ganharia um slug que nunca abre
// (a rota fixa vence o /:salonSlug). O servidor pula esses slugs (RESERVED_SLUGS em salonController).
const RESERVED = ['Sistema', 'Login', 'Termos', 'Meus Salões', 'Minha Conta']

test('nome de salão igual a uma rota do sistema não vira esse slug', async ({ page }) => {
  await createOwner(page)
  for (const name of RESERVED) {
    const salon = await createSalon(page, name)
    const reserved = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-')
    expect(salon.slug, `slug de "${name}"`).not.toBe(reserved)
    expect(salon.slug).toMatch(new RegExp(`^${reserved}-\\d+$`))
  }
})

test('salão chamado "Sistema" abre pelo próprio slug e /sistema continua sendo o painel', async ({ page }) => {
  await createOwner(page)
  const salon = await createSalon(page, 'Sistema')

  await page.goto(`/${salon.slug}/admin`)
  await expect(page).toHaveURL(new RegExp(`/${salon.slug}/admin`))
  await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible()

  // Para o dono do salão, /sistema não é o salão dele: é o painel, que não existe para ele
  await page.goto('/sistema')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
})
