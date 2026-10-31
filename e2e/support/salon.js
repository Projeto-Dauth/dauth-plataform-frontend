import { expect } from '@playwright/test'
import { E2E_API_URL } from '../../../backend/e2e/testEnv.js'
import prisma from './db.js'

// Cria um salão em trial pela API, como o usuário logado no `page` (precisa ser SalonOwner).
// Testes que mudam configuração usam um salão próprio para não afetar o Salão Demo dos outros testes.
export async function createSalon(page, name = `Salão E2E ${Date.now()}`) {
  const res = await page.request.post(`${E2E_API_URL}/api/v1/salon`, { data: { name } })
  expect(res.ok(), `criar salão "${name}" pela API`).toBeTruthy()
  return res.json() // { id, name, slug, status, joinCode: 'XXXX-XXXX', ... }
}

// Põe o salão num plano pago, em dia (direto no banco). O trial tem só as permissões do Essencial: teste que
// precisa de pacotes/produtos num salão próprio chama isto depois de criá-lo.
export const setPaidPlan = (salonId, plan = 'business') => prisma.salon.update({
  where: { id: salonId },
  data: { status: 'active', plan, trialEndsAt: null, planEndsAt: new Date(Date.now() + 30 * 86_400_000) },
})

// Código de acesso atual do salão (lido do banco), no formato que a tela mostra: XXXX-XXXX.
export async function joinCodeOf(salonId) {
  const { joinCode } = await prisma.salon.findUnique({ where: { id: salonId }, select: { joinCode: true } })
  return `${joinCode.slice(0, 4)}-${joinCode.slice(4)}`
}

// Vincula a pessoa logada no `page` ao salão pelo código (mesma rota que a tela usa). Devolve a resposta crua.
export const joinByCode = (page, code) =>
  page.request.post(`${E2E_API_URL}/api/v1/salon/join-by-code`, { data: { code } })

// Consulta do passo "este é o salão?" (mostra só nome/endereço). Devolve a resposta crua.
export const lookupCode = (page, code) =>
  page.request.get(`${E2E_API_URL}/api/v1/salon/by-code/${code}`)
