import { expect } from '@playwright/test'
import { E2E_API_URL, E2E_WEB_URL, E2E_SUPERADMIN, applyTestEnv } from '../../../backend/e2e/testEnv.js'
import { newSecret } from '../../../backend/e2e/mfaTestHelpers.js'
import { loginAs } from './session.js'
import prisma from './db.js'

// Painel /sistema (só E2E_SUPERADMIN, criada pelo e2e/server.js).
export const SYSTEM_API = `${E2E_API_URL}/api/v1`

// Escrita no painel só vale com o cabeçalho Origin de um endereço do sistema (como o navegador manda)
export const WRITE_HEADERS = { Origin: E2E_WEB_URL }

const systemUserId = async () => (await prisma.user.findFirst({ where: { email: E2E_SUPERADMIN.email }, select: { id: true } })).id

// Login da dona do sistema SEM destravar o painel (para testar o próprio MFA)
export const loginAsSystemLocked = (page) => loginAs(page, E2E_SUPERADMIN)

// Destrava, direto no banco, todas as sessões da dona do sistema (código digitado agora). Os testes cujo assunto não é o
// MFA usam isto — o código TOTP real é testado em sistema-mfa.spec.js.
export async function unlockSystemSessions(verifiedAt = new Date()) {
  const userId = await systemUserId()
  const now = new Date()
  const sessions = await prisma.session.findMany({ where: { userId }, select: { id: true } })
  for (const { id: sessionId } of sessions) {
    await prisma.systemUnlock.upsert({
      where: { sessionId },
      create: { sessionId, userId, verifiedAt, lastSeenAt: now },
      update: { verifiedAt, lastSeenAt: now },
    })
  }
}

// Login + painel destravado
export async function loginAsSystem(page) {
  await loginAsSystemLocked(page)
  await unlockSystemSessions()
}

// Cadastra o MFA da dona do sistema direto no banco, com um segredo conhecido. → o segredo (base32)
export async function enrollSystemMfa() {
  applyTestEnv()
  const { encryptSecret } = await import('../../../backend/src/config/systemMfa.js')
  const userId = await systemUserId()
  const secret = newSecret()
  const data = { secretEnc: encryptSecret(secret), confirmedAt: new Date(), recoveryHashes: '[]', lastStep: 0, failedCount: 0, lockedUntil: null }
  await prisma.systemMfa.upsert({ where: { userId }, create: { userId, ...data }, update: data })
  return secret
}

// Volta ao estado "nunca cadastrou MFA" e sem nenhum desbloqueio
export async function resetSystemMfa() {
  const userId = await systemUserId()
  await prisma.systemMfa.deleteMany({ where: { userId } })
  await prisma.systemUnlock.deleteMany({ where: { userId } })
}

// GET numa rota /system como o usuário logado no `page`; devolve o JSON (falha o teste se não for 200)
export async function systemGet(page, path, params) {
  const res = await page.request.get(`${SYSTEM_API}${path}`, { params })
  expect(res.status(), `GET ${path}`).toBe(200)
  return res.json()
}

// Escrita numa rota /system (com Origin). Devolve a resposta crua.
export const systemWrite = (page, method, path, data) =>
  page.request.fetch(`${SYSTEM_API}${path}`, { method, data, headers: WRITE_HEADERS })

// Erro do navegador como o front manda (rota pública)
export const reportClientError = (page, data) => page.request.post(`${SYSTEM_API}/client-errors`, { data })

// Linhas do log com um texto na mensagem — o log é gravado sem esperar, então os testes usam expect.poll
export const errorRows = (text) => prisma.errorLog.findMany({ where: { message: { contains: text } }, orderBy: { createdAt: 'asc' } })
