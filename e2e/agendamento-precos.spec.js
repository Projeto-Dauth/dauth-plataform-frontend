import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, loginAs } from './support/session.js'
import { newUserPage } from './support/browser.js'
import { createBookingSalon } from './support/bookingSalon.js'

// Dados públicos do salão (sem login) e o link de agendamento. Não existe mais página pública nem
// marketplace: o endpoint por slug só entrega o que o /agendar e o SalonLayout precisam.
// "Mostrar preços" fica em Configurações → Agendamento. Salão próprio por teste.

test.beforeEach(async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
})

test('mostrar preços: desligado, o link de agendamento não mostra valores', async ({ page, browser }) => {
  const s = await createBookingSalon(page)
  const visitor = await newUserPage(browser)

  await visitor.goto(`/${s.salon.slug}/agendar`)
  await expect(visitor.getByRole('button', { name: /Corte E2E/ })).toBeVisible()
  await expect(visitor.getByText(/R\$\s?50,00/)).toBeVisible()

  // Pela tela de Configurações → Agendamento
  await page.goto(`/${s.salon.slug}/admin/configuracoes`)
  await page.getByRole('tab', { name: 'Agendamento' }).click()
  await page.getByRole('switch', { name: 'Mostrar preços' }).click()
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Todas as alterações estão salvas')).toBeVisible()

  await visitor.reload()
  await expect(visitor.getByRole('button', { name: /Corte E2E/ })).toBeVisible()
  await expect(visitor.getByText(/R\$/)).toHaveCount(0)
})

test('dados públicos por slug: só o necessário, sem serviços, equipe, contato nem horários', async ({ page, browser }) => {
  const s = await createBookingSalon(page)
  const visitor = await newUserPage(browser)

  const res = await visitor.request.get(`${E2E_API_URL}/api/v1/platform/salons/${s.salon.slug}`)
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(Object.keys(body).sort()).toEqual(['active', 'bookingEnabled', 'bookingMaxDaysAhead', 'colorPalette', 'id', 'name', 'plan', 'showPrices', 'slug'])
  expect(JSON.stringify(body)).not.toContain(s.pro.name)
  expect((await visitor.request.get(`${E2E_API_URL}/api/v1/platform/salons/nao-existe-${Date.now()}`)).status()).toBe(404)

  // A listagem do marketplace não existe mais: sem login nem chega a responder lista
  const list = await visitor.request.get(`${E2E_API_URL}/api/v1/platform/salons`)
  expect([401, 404]).toContain(list.status())
})

test('salão que não existe no link de agendamento mostra a página de não encontrado', async ({ browser }) => {
  const visitor = await newUserPage(browser)
  await visitor.goto(`/salao-que-nao-existe-${Date.now()}/agendar`)
  await expect(visitor.getByRole('button', { name: /Corte/ })).toHaveCount(0)
  await expect(visitor).toHaveURL(/\/agendar$/) // não redireciona para outra tela (marketplace)
})
