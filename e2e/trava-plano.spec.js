import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, loginAs } from './support/session.js'
import { createSalon } from './support/salon.js'
import prisma from './support/db.js'

// Fluxo: salão no plano Essencial (pago) não tem Produtos — o menu mostra o item travado, o clique
// abre o upgrade em vez de entrar na tela, e a API recusa criar produto.
test('plano Essencial trava Produtos no menu e na API', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  const salon = await createSalon(page)
  // Pagamento tem teste próprio; aqui só interessa o salão já estar no Essencial ativo
  await prisma.salon.update({ where: { id: salon.id }, data: { status: 'active', plan: 'essencial' } })

  await page.goto(`/${salon.slug}/admin`)
  await page.getByRole('button', { name: 'Produtos', exact: true }).click() // travado = botão, não link
  await expect(page.getByRole('heading', { name: 'Produtos não está no seu plano' })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/${salon.slug}/admin$`)) // não navegou para a tela

  const res = await page.request.post(`${E2E_API_URL}/api/product`, {
    headers: { 'x-salon-id': salon.id },
    data: { Name: 'Produto E2E', Price: 10 },
  })
  expect(res.status()).toBe(403)
  expect((await res.json()).error).toContain('exige o plano Profissional') // 403 da trava de plano, não de permissão
})
