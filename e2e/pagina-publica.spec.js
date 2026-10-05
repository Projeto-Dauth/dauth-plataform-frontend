import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, loginAs } from './support/session.js'
import { newUserPage } from './support/browser.js'
import { createBookingSalon, setSettings } from './support/bookingSalon.js'

// Página pública do salão (/salao/:slug), vista por um visitante sem login. Configurações →
// Página pública: "Mostrar preços" e "Mostrar equipe". Salão próprio por teste.

test.beforeEach(async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
})

const publicApi = async (page, slug) => (await page.request.get(`${E2E_API_URL}/api/v1/platform/salons/${slug}`)).json()

test('preços escondidos: somem da página e da API pública', async ({ page, browser }) => {
  const s = await createBookingSalon(page)
  const visitor = await newUserPage(browser)

  await visitor.goto(`/salao/${s.salon.slug}`)
  await expect(visitor.getByText('Corte E2E')).toBeVisible()
  await expect(visitor.getByText(/R\$\s?50,00/)).toBeVisible()

  await setSettings(page, s.salon.id, { showPrices: false })
  await visitor.reload()
  await expect(visitor.getByText('Corte E2E')).toBeVisible()
  await expect(visitor.getByText(/R\$/)).toHaveCount(0)
  expect((await publicApi(visitor, s.salon.slug)).services.map(x => x.price), 'a API também não entrega o preço').toEqual([null, null])
})

test('equipe: aparece só quando ligada, e só com quem atende algum serviço', async ({ page, browser }) => {
  const s = await createBookingSalon(page)
  const visitor = await newUserPage(browser)

  await visitor.goto(`/salao/${s.salon.slug}`)
  await expect(visitor.getByText('Corte E2E')).toBeVisible()
  await expect(visitor.getByText('Equipe', { exact: true }), 'desligada por padrão').toHaveCount(0)

  await setSettings(page, s.salon.id, { showTeam: true })
  await visitor.reload()
  await expect(visitor.getByText('Equipe', { exact: true })).toBeVisible()
  await expect(visitor.getByText(s.pro.name)).toBeVisible()
  // O dono (Admin) não atende nenhum serviço neste salão: não entra na equipe
  expect((await publicApi(visitor, s.salon.slug)).team.map(m => m.name)).toEqual([s.pro.name])
})
