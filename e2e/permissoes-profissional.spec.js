import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from './support/session.js'
import { newUserPage } from './support/browser.js'
import { demoSalon, memberId } from './support/demo.js'
import prisma from './support/db.js'

// Fluxo: o Admin tira da profissional o acesso ao Caixa → ela deixa de ver "Comandas" no menu, é
// barrada ao abrir a página pela URL e a API recusa. A Ana é usada por outros testes: a permissão
// é devolvida no fim, mesmo se o teste falhar (sem registro = módulo liberado).
let anaId
test.afterEach(async () => {
  if (anaId) await prisma.professionalPermission.deleteMany({ where: { memberId: anaId } })
})

test('profissional sem acesso ao Caixa não vê nem acessa as comandas', async ({ page, browser }) => {
  const salon = await demoSalon()
  anaId = await memberId(salon.id, SEED_USERS.profissional)

  const ana = await newUserPage(browser)
  await loginAs(ana, SEED_USERS.profissional)
  const comandasLink = ana.getByRole('link', { name: 'Comandas', exact: true })
  await ana.goto(`/${SEED_SALON_SLUG}/profissional`)
  await expect(comandasLink).toBeVisible() // antes: acesso liberado

  // Admin restringe pela ficha da profissional
  await loginAs(page, SEED_USERS.owner)
  await page.goto(`/${SEED_SALON_SLUG}/admin/usuarios`)
  await page.getByPlaceholder('Buscar por nome ou telefone…').fill('Ana')
  await page.getByRole('row', { name: /Ana Profissional/ }).click()
  const caixaRow = page.locator('div').filter({ has: page.getByText('Caixa', { exact: true }) })
    .filter({ has: page.getByLabel('Visualizar') }).last()
  await caixaRow.getByLabel('Visualizar').uncheck()
  await page.getByRole('button', { name: 'Salvar permissões' }).click()
  await expect.poll(async () => (await prisma.professionalPermission.findFirst({ where: { memberId: anaId, module: 'Caixa' } }))?.canView)
    .toBe(false)

  // Profissional: sem o menu, barrada pela URL e pela API
  await ana.goto(`/${SEED_SALON_SLUG}/profissional`)
  await expect(ana.getByRole('link', { name: 'Agenda', exact: true })).toBeVisible()
  await expect(comandasLink).toBeHidden()
  await ana.goto(`/${SEED_SALON_SLUG}/profissional/comandas`)
  await expect(ana).toHaveURL(/\/nao-autorizado$/)
  const res = await ana.request.get(`${E2E_API_URL}/api/tab`, { headers: { 'x-salon-id': salon.id } })
  expect(res.status()).toBe(403)
  expect((await res.json()).error).toContain('módulo Caixa')
})
