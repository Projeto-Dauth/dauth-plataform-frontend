import { test, expect } from '@playwright/test'
import { E2E_API_URL } from '../../backend/e2e/testEnv.js'
import { SEED_USERS, loginAs } from './support/session.js'
import { createSalon } from './support/salon.js'

// Salão arquivado não atende o produto: antes só o front barrava, a API seguia respondendo.
// Arquivar/desarquivar é da plataforma (sem tenant) e continua funcionando — senão o dono não teria como voltar.
test('salão arquivado é recusado na API do produto e volta ao desarquivar', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  const salon = await createSalon(page)
  const agenda = () => page.request.get(`${E2E_API_URL}/api/appointment`, { headers: { 'x-salon-id': salon.id } })
  const archive = () => page.request.patch(`${E2E_API_URL}/api/v1/salon/${salon.id}/archive`)

  expect((await agenda()).status(), 'antes de arquivar').toBe(200)

  expect((await archive()).ok(), 'arquivar').toBe(true)
  const blocked = await agenda()
  expect(blocked.status(), 'arquivado').toBe(403)
  expect((await blocked.json()).error).toMatch(/arquivado/i)

  expect((await archive()).ok(), 'desarquivar').toBe(true)
  expect((await agenda()).status(), 'desarquivado').toBe(200)
})
