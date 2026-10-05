import { expect } from '@playwright/test'
import { E2E_API_URL } from '../../../backend/e2e/testEnv.js'

// Cria um salão em trial pela API, como o usuário logado no `page` (precisa ser SalonOwner).
// Testes que mudam configuração usam um salão próprio para não afetar o Salão Demo dos outros testes.
export async function createSalon(page, name = `Salão E2E ${Date.now()}`) {
  const res = await page.request.post(`${E2E_API_URL}/api/v1/salon`, { data: { name } })
  expect(res.ok(), `criar salão "${name}" pela API`).toBeTruthy()
  return res.json() // { id, name, slug, status, ... }
}
