import { expect } from '@playwright/test'
import { E2E_API_URL, E2E_SUPERADMIN } from '../../../backend/e2e/testEnv.js'
import { loginAs } from './session.js'
import prisma from './db.js'

// Painel /sistema (só E2E_SUPERADMIN, criada pelo e2e/server.js).
export const SYSTEM_API = `${E2E_API_URL}/api/v1`

export const loginAsSystem = (page) => loginAs(page, E2E_SUPERADMIN)

// GET numa rota /system como o usuário logado no `page`; devolve o JSON (falha o teste se não for 200)
export async function systemGet(page, path, params) {
  const res = await page.request.get(`${SYSTEM_API}${path}`, { params })
  expect(res.status(), `GET ${path}`).toBe(200)
  return res.json()
}

// Erro do navegador como o front manda (rota pública)
export const reportClientError = (page, data) => page.request.post(`${SYSTEM_API}/client-errors`, { data })

// Linhas do log com um texto na mensagem — o log é gravado sem esperar, então os testes usam expect.poll
export const errorRows = (text) => prisma.errorLog.findMany({ where: { message: { contains: text } }, orderBy: { createdAt: 'asc' } })
