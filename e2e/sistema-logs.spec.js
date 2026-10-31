import { test, expect } from '@playwright/test'
import { loginAs, SEED_USERS } from './support/session.js'
import { demoSalon } from './support/demo.js'
import { SYSTEM_API, loginAsSystem, systemGet, reportClientError, errorRows } from './support/system.js'
import prisma from './support/db.js'

// Log de erros do painel /sistema: só 5xx/exceções, origem backend × frontend, sem dado pessoal nem query string,
// erros iguais agrupados, retenção de 14 dias. O painel em si (trava, salões) está em sistema.spec.js.
const DAY = 86_400_000
// Só letras: o log normaliza números (ids, horários) para agrupar o mesmo erro — um rótulo que variasse só nos
// números cairia no grupo da execução anterior em vez de abrir uma linha nova
const letters = (n) => Array.from({ length: n }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('')
const tag = (label) => `E2E-${label}-${letters(10)}`

// Os tratadores e o log do backend rodam aqui no processo do teste, contra o banco de teste (support/db.js já
// apontou o Prisma para ele): não existe — nem deve existir — rota que dê 500 de propósito.
const backend = async () => ({
  platform: (await import('../../backend/src/platform/utils/errorHandler.js')).handleError,
  produto: (await import('../../backend/src/produto/utils/errorHandler.js')).handleError,
  log: await import('../../backend/src/config/errorLog.js'),
  purge: (await import('../../backend/src/platform/jobs/purgeErrorLogs.js')).purgeErrorLogs,
})

// Resposta falsa do Express: os tratadores pegam a requisição em res.req
const fakeRes = (req) => ({ req, statusCode: 200, status(c) { this.statusCode = c; return this }, json() { return this } })

// Erro "do navegador" disparado na página como o navegador faria
const dispatchWindowError = (page, message, filename) => page.evaluate(([message, filename]) => {
  window.dispatchEvent(new ErrorEvent('error', { message, error: new Error(message), filename: filename ?? `${location.origin}/src/Tela.jsx`, lineno: 7 }))
}, [message, filename])

test('backend: 500 dos tratadores vai para o log com rota e salão, sem query nem dado pessoal', async () => {
  const { platform, produto } = await backend()
  const t1 = tag('PLATAFORMA')
  const t2 = tag('PRODUTO')
  const req = { method: 'PATCH', originalUrl: '/api/v1/salon/config?token=segredo', headers: { 'x-salon-id': 'salao-x' } }

  const r1 = fakeRes(req)
  platform(r1, new Error(`${t1} falhou para maria@exemplo.com no (11) 9 8765-4321`), 'salonController.updateConfig')
  expect(r1.statusCode).toBe(500)
  const r2 = fakeRes({ method: 'GET', originalUrl: '/api/tab', headers: {}, salonId: 'salao-y', user: { id: 'user-y' } })
  produto(r2, new Error(t2), 'tabController.find')
  expect(r2.statusCode).toBe(500)

  await expect.poll(async () => (await errorRows(t1)).length).toBe(1)
  const [row] = await errorRows(t1)
  expect(row).toMatchObject({ origin: 'backend', source: 'http', method: 'PATCH', path: '/api/v1/salon/config', status: 500, salonId: 'salao-x', context: 'salonController.updateConfig' })
  expect(row.message).not.toContain('maria@exemplo.com')
  expect(row.message).not.toContain('8765-4321')
  expect(row.message).toContain('ma***@exemplo.com')
  expect(row.stack).toBeTruthy()

  await expect.poll(async () => (await errorRows(t2)).length).toBe(1)
  expect((await errorRows(t2))[0]).toMatchObject({ origin: 'backend', path: '/api/tab', salonId: 'salao-y', userId: 'user-y' })
})

test('backend: erros de negócio e de validação (4xx) não entram no log', async () => {
  const { platform, produto } = await backend()
  const t = tag('NEGOCIO')
  const req = { method: 'POST', originalUrl: '/api/x', headers: {} }

  const conflict = Object.assign(new Error(`${t} 409`), { statusCode: 409 })
  const duplicate = Object.assign(new Error(`${t} P2002`), { code: 'P2002', meta: { target: ['slug'] } })
  const r1 = fakeRes(req); platform(r1, conflict, 'x'); expect(r1.statusCode).toBe(409)
  const r2 = fakeRes(req); produto(r2, duplicate, 'x'); expect(r2.statusCode).toBe(409)
  const r3 = fakeRes(req); produto(r3, Object.assign(new Error(`${t} 422`), { status: 422 }), 'x'); expect(r3.statusCode).toBe(422)

  await new Promise(r => setTimeout(r, 500)) // o log é gravado sem esperar
  expect(await errorRows(t)).toHaveLength(0)

  // JSON malformado é erro do cliente: o tratador global do Express não grava
  const start = new Date()
  const res = await fetch(`${SYSTEM_API}/client-errors`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{quebrado' })
  expect(res.status).toBeGreaterThanOrEqual(400)
  await new Promise(r => setTimeout(r, 500))
  expect(await prisma.errorLog.count({ where: { origin: 'backend', createdAt: { gte: start } } })).toBe(0)
})

test('backend: o mesmo erro em 1h vira uma linha com contador; erro diferente vira outra', async () => {
  const { log } = await backend()
  const t = tag('GRUPO')
  const req = { method: 'GET', originalUrl: '/api/appointment/abc', headers: {} }

  // Ids e números na mensagem não separam o grupo
  await log.logBackendError(new Error(`${t} agendamento 123 não carregou`), { req })
  await log.logBackendError(new Error(`${t} agendamento 456 não carregou`), { req })
  await log.logBackendError(new Error(`${t} agendamento 789 não carregou`), { req })
  await log.logBackendError(new Error(`${t} outro problema`), { req })

  const rows = await errorRows(t)
  expect(rows).toHaveLength(2)
  expect(rows.find(r => r.message.includes('agendamento')).occurrences).toBe(3)
  expect(rows.find(r => r.message.includes('outro')).occurrences).toBe(1)

  // Passada 1h do último, o mesmo erro abre uma linha nova
  const grouped = rows.find(r => r.message.includes('agendamento'))
  await prisma.errorLog.update({ where: { id: grouped.id }, data: { lastSeenAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } })
  await log.logBackendError(new Error(`${t} agendamento 999 não carregou`), { req })
  expect((await errorRows(t)).filter(r => r.message.includes('agendamento'))).toHaveLength(2)
})

test('backend: erro de rotina agendada (job) e de processo também são gravados', async () => {
  const { log } = await backend()
  const t = tag('JOB')
  await log.logBackendError(new Error(`${t} lembrete`), { source: 'job', context: 'appointmentReminders' })
  await log.logBackendError(new Error(`${t} processo`), { source: 'process', context: 'unhandledRejection' })
  const rows = await errorRows(t)
  expect(rows.map(r => r.source).sort()).toEqual(['job', 'process'])
  expect(rows.every(r => r.path == null && r.status == null)).toBeTruthy()
})

test('rota de erros do navegador: pública, sempre 204, corpo saneado', async ({ page }) => {
  const t = tag('ROTA')
  // Sem mensagem: nada é gravado
  expect((await reportClientError(page, { source: 'render' })).status()).toBe(204)

  const res = await reportClientError(page, {
    source: 'hackeado', message: `${t} pedro@exemplo.com`, stack: 'x'.repeat(10_000),
    path: '/salao-demo/admin?token=segredo', salonId: 'salao-z', context: 'Componente',
  })
  expect(res.status()).toBe(204)
  await expect.poll(async () => (await errorRows(t)).length).toBe(1)
  const [row] = await errorRows(t)
  expect(row).toMatchObject({ origin: 'frontend', source: 'window', path: '/salao-demo/admin', salonId: 'salao-z', context: 'Componente', userId: null })
  expect(row.stack.length).toBeLessThanOrEqual(4000)
  expect(row.message).not.toContain('pedro@exemplo.com')
})

test('navegador: erro de script e promessa sem tratamento são relatados com a conta e o salão', async ({ page }) => {
  await loginAs(page, SEED_USERS.owner)
  await page.goto('/meus-saloes')
  await page.getByRole('button', { name: 'Entrar em Salão Demo' }).click()
  await expect(page).toHaveURL(/\/salao-demo\//)
  const salon = await demoSalon()
  const { id: ownerId } = await prisma.user.findFirst({ where: { phone: SEED_USERS.owner.phone }, select: { id: true } })

  // Erro de script do próprio site (duas vezes: o navegador manda uma só)
  const t1 = tag('SCRIPT')
  await dispatchWindowError(page, t1)
  await dispatchWindowError(page, t1)
  await expect.poll(async () => (await errorRows(t1)).length).toBe(1)
  const [row] = await errorRows(t1)
  expect(row).toMatchObject({ origin: 'frontend', source: 'window', salonId: salon.id, userId: ownerId, occurrences: 1 })
  expect(row.path).toMatch(/^\/salao-demo\//)
  expect(row.context).toContain('/src/Tela.jsx:7')

  // Promessa rejeitada sem tratamento
  const t2 = tag('PROMESSA')
  await page.evaluate((m) => window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', { promise: Promise.resolve(), reason: new Error(m) })), t2)
  await expect.poll(async () => (await errorRows(t2)).map(r => r.source)).toEqual(['promise'])

  // Fora do escopo: script de extensão do navegador e erro de API (o backend já registra os 5xx)
  const t3 = tag('EXTENSAO')
  await dispatchWindowError(page, t3, 'chrome-extension://abc/content.js')
  const t4 = tag('AXIOS')
  await page.evaluate((m) => window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', {
    promise: Promise.resolve(), reason: Object.assign(new Error(m), { isAxiosError: true }),
  })), t4)
  await page.waitForTimeout(800)
  expect(await errorRows(t3)).toHaveLength(0)
  expect(await errorRows(t4)).toHaveLength(0)
})

test('tela que quebra mostra "Algo deu errado" e o erro vai para o log como "render"', async ({ page }) => {
  // O painel é carregado sob demanda: se o arquivo não chega (ex: deploy no meio do uso), a rota quebra
  await page.route(/\/src\/pages\/sistema\/SistemaPage\.jsx/, route => route.abort())
  const start = new Date()
  await page.goto('/sistema')

  await expect(page.getByRole('heading', { name: 'Algo deu errado nesta tela' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Recarregar a página' })).toBeVisible()
  await expect.poll(() => prisma.errorLog.count({
    where: { origin: 'frontend', source: 'render', path: '/sistema', lastSeenAt: { gte: start } },
  })).toBeGreaterThan(0)
})

test('aba Erros: filtro front/back, busca, período e detalhe com stack', async ({ page }) => {
  const t = tag('TELA')
  const { log } = await backend()
  await log.logBackendError(new Error(`${t} servidor caiu`), { req: { method: 'POST', originalUrl: '/api/tab/batch-pay', headers: {} } })
  await reportClientError(page, { source: 'render', message: `${t} tela caiu`, stack: `Error: tela caiu\n    at Caixa (Caixa.jsx:10:5)`, path: '/salao-demo/admin/caixa' })
  // Erro de 10 dias atrás: só aparece no período de 14 dias
  await prisma.errorLog.create({
    data: { origin: 'backend', source: 'http', message: `${t} antigo`, fingerprint: `${t}-antigo`, createdAt: new Date(Date.now() - 10 * DAY), lastSeenAt: new Date(Date.now() - 10 * DAY) },
  })
  await expect.poll(async () => (await errorRows(t)).length).toBe(3)

  await loginAsSystem(page)
  await page.goto('/sistema?tab=erros')
  await page.getByLabel('Buscar erro').fill(t)
  await expect(page.getByText(`${t} servidor caiu`)).toBeVisible()
  await expect(page.getByText(`${t} tela caiu`)).toBeVisible()
  await expect(page.getByText(`${t} antigo`)).toBeVisible()

  await page.getByLabel('Origem').selectOption('frontend')
  await expect(page.getByText(`${t} tela caiu`)).toBeVisible()
  await expect(page.getByText(`${t} servidor caiu`)).toHaveCount(0)

  await page.getByLabel('Origem').selectOption('backend')
  await expect(page.getByText(`${t} servidor caiu`)).toBeVisible()
  await expect(page.getByText(`${t} tela caiu`)).toHaveCount(0)

  await page.getByLabel('Período').selectOption('1')
  await expect(page.getByText(`${t} servidor caiu`)).toBeVisible()
  await expect(page.getByText(`${t} antigo`)).toHaveCount(0)

  // Detalhe
  await page.getByLabel('Origem').selectOption('')
  await page.getByText(`${t} tela caiu`).click()
  const panel = page.getByRole('dialog', { name: 'Detalhe do erro' })
  await expect(panel.getByText('Frontend')).toBeVisible()
  await expect(panel.getByText('Tela quebrou')).toBeVisible()
  await expect(panel.getByText('/salao-demo/admin/caixa', { exact: true })).toBeVisible()
  await expect(panel.getByText(/at Caixa \(Caixa\.jsx:10:5\)/)).toBeVisible()

  // "Copiar erro" leva mensagem, onde e stack para colar numa conversa
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await panel.getByRole('button', { name: 'Copiar erro' }).click()
  await expect(page.getByText('Erro copiado.', { exact: false })).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toContain(`Mensagem: ${t} tela caiu`)
  expect(copied).toContain('Origem: frontend (Tela quebrou)')
  expect(copied).toContain('Onde: /salao-demo/admin/caixa')
  expect(copied).toContain('at Caixa (Caixa.jsx:10:5)')
})

test('erros de um salão: o detalhe do salão leva à aba Erros filtrada só por ele', async ({ page }) => {
  const salon = await demoSalon()
  const t = tag('SALAO')
  await reportClientError(page, { source: 'window', message: `${t} do Salão Demo`, salonId: salon.id })
  await reportClientError(page, { source: 'window', message: `${t} de outro salão`, salonId: 'outro-salao' })
  await expect.poll(async () => (await errorRows(t)).length).toBe(2)

  // API: filtro por salão
  await loginAsSystem(page)
  const { data } = await systemGet(page, '/system/errors', { salonId: salon.id, search: t })
  expect(data.map(e => e.message)).toEqual([`${t} do Salão Demo`])
  expect(data[0].salonName).toBe('Salão Demo')

  // Tela: detalhe do salão → "Ver todos"
  await page.goto('/sistema?tab=saloes')
  await page.getByLabel('Buscar salão').fill('Salão Demo')
  await page.getByRole('button', { name: 'Ver Salão Demo', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Salão Demo' })
  await expect(panel.getByText(`${t} do Salão Demo`)).toBeVisible()
  await panel.getByRole('button', { name: 'Ver todos' }).click()

  await expect(page.getByRole('tab', { name: 'Erros', selected: true })).toBeVisible()
  await expect(page.getByText('Mostrando só os erros de um salão.')).toBeVisible()
  await page.getByLabel('Buscar erro').fill(t)
  await expect(page.getByText(`${t} do Salão Demo`)).toBeVisible()
  await expect(page.getByText(`${t} de outro salão`)).toHaveCount(0)

  await page.getByRole('button', { name: 'Ver de todos' }).click()
  await expect(page.getByText(`${t} de outro salão`)).toBeVisible()
})

test('Visão geral conta os erros das últimas 24h separados em backend e frontend', async ({ page }) => {
  await loginAsSystem(page)
  const before = (await systemGet(page, '/system/summary')).errors24h
  const { log } = await backend()
  const t = tag('RESUMO')
  await log.logBackendError(new Error(`${t} back`), { req: { method: 'GET', originalUrl: '/api/x', headers: {} } })
  await log.logBackendError(new Error(`${t} back`), { req: { method: 'GET', originalUrl: '/api/x', headers: {} } })
  await reportClientError(page, { source: 'render', message: `${t} front` })
  await expect.poll(async () => (await errorRows(t)).length).toBe(2)

  const after = (await systemGet(page, '/system/summary')).errors24h
  expect(after.backend.groups - before.backend.groups).toBe(1)
  expect(after.backend.occurrences - before.backend.occurrences).toBe(2)
  expect(after.frontend.groups - before.frontend.groups).toBe(1)
  expect(after.frontend.occurrences - before.frontend.occurrences).toBe(1)
})

test('retenção: erros e acessos ao painel com mais de 14 dias são apagados; os mais novos ficam', async () => {
  const { purge } = await backend()
  const t = tag('RETENCAO')
  const at = (days) => new Date(Date.now() - days * DAY)
  const row = (label, days) => ({ origin: 'backend', source: 'http', message: `${t} ${label}`, fingerprint: `${t}-${label}`, createdAt: at(days), lastSeenAt: at(days) })

  await prisma.errorLog.createMany({ data: [row('15 dias', 15), row('13 dias', 13), row('hoje', 0)] })
  // Começou há 20 dias mas voltou a acontecer há 2: conta a última ocorrência
  await prisma.errorLog.create({ data: { ...row('recorrente', 20), lastSeenAt: at(2) } })
  const oldAccess = await prisma.systemAccessLog.create({ data: { userId: `${t}-u`, createdAt: at(15) } })
  const newAccess = await prisma.systemAccessLog.create({ data: { userId: `${t}-u`, createdAt: at(13) } })

  await purge(prisma)

  expect((await errorRows(t)).map(r => r.message.replace(`${t} `, '')).sort()).toEqual(['13 dias', 'hoje', 'recorrente'])
  expect(await prisma.systemAccessLog.findUnique({ where: { id: oldAccess.id } })).toBeNull()
  expect(await prisma.systemAccessLog.findUnique({ where: { id: newAccess.id } })).not.toBeNull()
})
