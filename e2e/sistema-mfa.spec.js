import { test, expect } from '@playwright/test'
import { E2E_SUPERADMIN } from '../../backend/e2e/testEnv.js'
import { totpCode } from '../../backend/e2e/mfaTestHelpers.js'
import { SYSTEM_API, WRITE_HEADERS, loginAsSystemLocked, enrollSystemMfa, resetSystemMfa, systemWrite } from './support/system.js'
import { newUserPage } from './support/browser.js'
import prisma from './support/db.js'

// MFA (app autenticador) do painel /sistema. Os testes mexem no cadastro da única conta do painel, então rodam em série
// e cada um começa do zero (sem MFA e sem desbloqueio). Os demais specs do painel destravam direto no banco.
test.describe.configure({ mode: 'serial' })

const post = (page, path, data) => page.request.post(`${SYSTEM_API}${path}`, { data, headers: WRITE_HEADERS })
const get = (page, path) => page.request.get(`${SYSTEM_API}${path}`)
const userId = async () => (await prisma.user.findFirst({ where: { email: E2E_SUPERADMIN.email }, select: { id: true } })).id
const auditCount = async (action) => prisma.systemAuditLog.count({ where: { action, userId: await userId() } })

test.beforeEach(async ({ page }) => {
  await resetSystemMfa()
  await loginAsSystemLocked(page)
})

test('sem desbloqueio nada do painel abre, e a resposta diz o que falta', async ({ page }) => {
  for (const path of ['/system/summary', '/system/salons', '/system/salons/qualquer', '/system/errors', '/system/audit']) {
    const res = await get(page, path)
    expect(res.status(), path).toBe(403)
    expect((await res.json()).code, path).toBe('MFA_SETUP_REQUIRED')
  }
  const write = await systemWrite(page, 'PATCH', '/system/salons/qualquer', { name: 'Qualquer', reason: 'teste do MFA' })
  expect(write.status()).toBe(403)
  expect((await write.json()).code).toBe('MFA_SETUP_REQUIRED')

  // A entrada continua abrindo, e o status mostra o estado
  expect((await get(page, '/system/me')).status()).toBe(200)
  expect(await (await get(page, '/system/mfa/status')).json()).toEqual({ enrolled: false, unlocked: false })

  // Com o MFA cadastrado a mensagem muda: agora falta o código
  await enrollSystemMfa()
  const res = await get(page, '/system/summary')
  expect(res.status()).toBe(403)
  expect((await res.json()).code).toBe('MFA_REQUIRED')
})

test('cadastro: pede a senha da conta, entrega QR e códigos de recuperação, e só vale com o código certo', async ({ page }) => {
  expect((await post(page, '/system/mfa/setup', { password: 'senha-errada' })).status()).toBe(403)

  const setup = await post(page, '/system/mfa/setup', { password: E2E_SUPERADMIN.password })
  expect(setup.status()).toBe(200)
  const { secret, qr } = await setup.json()
  expect(qr).toMatch(/^data:image\/png;base64,/)

  // O segredo não fica em claro no banco, e sem confirmar o painel continua fechado
  const row = await prisma.systemMfa.findUnique({ where: { userId: await userId() } })
  expect(row.secretEnc).not.toContain(secret)
  expect(row.confirmedAt).toBeNull()
  expect((await get(page, '/system/summary')).status()).toBe(403)

  expect((await post(page, '/system/mfa/confirm', { code: '12345' })).status()).toBe(403)
  const confirm = await post(page, '/system/mfa/confirm', { code: totpCode(secret) })
  expect(confirm.status()).toBe(200)
  const { recoveryCodes } = await confirm.json()
  expect(recoveryCodes).toHaveLength(8)
  expect(new Set(recoveryCodes).size).toBe(8)

  // Só os hashes dos códigos de recuperação ficam no banco
  const saved = await prisma.systemMfa.findUnique({ where: { userId: await userId() } })
  expect(saved.confirmedAt).not.toBeNull()
  for (const code of recoveryCodes) expect(saved.recoveryHashes).not.toContain(code.replace('-', ''))

  expect(await (await get(page, '/system/mfa/status')).json()).toEqual({ enrolled: true, unlocked: true })
  expect((await get(page, '/system/summary')).status()).toBe(200)

  // Com o MFA ativo ninguém recadastra por cima (nem com a senha certa)
  expect((await post(page, '/system/mfa/setup', { password: E2E_SUPERADMIN.password })).status()).toBe(409)
  expect(await auditCount('mfa.enroll')).toBeGreaterThanOrEqual(1)
})

test('o mesmo código não vale duas vezes; o do passo seguinte vale', async ({ page }) => {
  const secret = await enrollSystemMfa()
  const code = totpCode(secret)
  expect((await post(page, '/system/mfa/verify', { code })).status()).toBe(200)
  expect((await post(page, '/system/mfa/verify', { code })).status()).toBe(403) // reuso
  expect((await post(page, '/system/mfa/verify', { code: totpCode(secret, 1) })).status()).toBe(200)
})

test('5 códigos errados travam a conta por 15 min, até com o código certo', async ({ page }) => {
  const secret = await enrollSystemMfa()
  for (let i = 0; i < 4; i++) expect((await post(page, '/system/mfa/verify', { code: '111111' })).status(), `tentativa ${i + 1}`).toBe(403)
  const fifth = await post(page, '/system/mfa/verify', { code: '111111' })
  expect(fifth.status()).toBe(429)
  expect((await fifth.json()).code).toBe('MFA_LOCKED')

  const right = await post(page, '/system/mfa/verify', { code: totpCode(secret) })
  expect(right.status()).toBe(429)
  expect((await get(page, '/system/summary')).status()).toBe(403)

  const row = await prisma.systemMfa.findUnique({ where: { userId: await userId() } })
  expect(row.lockedUntil.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000)
  expect(await auditCount('mfa.locked')).toBeGreaterThanOrEqual(1)
})

test('código de recuperação vale uma vez só', async ({ page }) => {
  const { secret } = await (await post(page, '/system/mfa/setup', { password: E2E_SUPERADMIN.password })).json()
  const { recoveryCodes } = await (await post(page, '/system/mfa/confirm', { code: totpCode(secret) })).json()
  await post(page, '/system/mfa/lock')
  expect((await get(page, '/system/summary')).status()).toBe(403)

  const usedBefore = await auditCount('mfa.recovery_used') // o banco é compartilhado entre os testes: conta só o aumento
  const first = await post(page, '/system/mfa/verify', { recoveryCode: recoveryCodes[0].toUpperCase() })
  expect(first.status()).toBe(200)
  expect((await first.json()).recoveryLeft).toBe(7)
  expect((await get(page, '/system/summary')).status()).toBe(200)

  expect((await post(page, '/system/mfa/verify', { recoveryCode: recoveryCodes[0] })).status()).toBe(403)
  expect(await auditCount('mfa.recovery_used')).toBe(usedBefore + 1)
})

test('escrita exige origem confiável e código recente; inatividade trava o painel', async ({ page }) => {
  const secret = await enrollSystemMfa()
  expect((await post(page, '/system/mfa/verify', { code: totpCode(secret) })).status()).toBe(200)
  const url = `${SYSTEM_API}/system/salons/nao-existe/suspend`
  const body = { reason: 'teste das camadas' }

  // Sem o cabeçalho Origin (requisição forjada por outro site, ou fora do navegador)
  const noOrigin = await page.request.post(url, { data: body })
  expect(noOrigin.status()).toBe(403)
  expect((await noOrigin.json()).error).toBe('Origem não permitida.')

  // Passa por todas as camadas e só então esbarra no salão inexistente
  expect((await systemWrite(page, 'POST', '/system/salons/nao-existe/suspend', body)).status()).toBe(404)

  // Último código há 10 min: ler continua, alterar pede o código de novo
  await prisma.systemUnlock.updateMany({ where: { userId: await userId() }, data: { verifiedAt: new Date(Date.now() - 10 * 60 * 1000) } })
  expect((await get(page, '/system/summary')).status()).toBe(200)
  const stale = await systemWrite(page, 'POST', '/system/salons/nao-existe/suspend', body)
  expect(stale.status()).toBe(403)
  expect((await stale.json()).code).toBe('MFA_STEP_UP')
  expect((await post(page, '/system/mfa/verify', { code: totpCode(secret, 2) })).status()).toBe(403) // 1 min à frente: fora da janela
  expect((await post(page, '/system/mfa/verify', { code: totpCode(secret, 1) })).status()).toBe(200)
  expect((await systemWrite(page, 'POST', '/system/salons/nao-existe/suspend', body)).status()).toBe(404)

  // 20 min sem usar: o painel trava
  await prisma.systemUnlock.updateMany({ where: { userId: await userId() }, data: { lastSeenAt: new Date(Date.now() - 20 * 60 * 1000) } })
  const idle = await get(page, '/system/summary')
  expect(idle.status()).toBe(403)
  expect((await idle.json()).code).toBe('MFA_REQUIRED')
})

test('o desbloqueio é da sessão: outro login pede o código, e "Travar painel" fecha na hora', async ({ page, browser }) => {
  const secret = await enrollSystemMfa()
  expect((await post(page, '/system/mfa/verify', { code: totpCode(secret) })).status()).toBe(200)
  expect((await get(page, '/system/summary')).status()).toBe(200)

  const other = await newUserPage(browser)
  await loginAsSystemLocked(other)
  expect((await get(other, '/system/summary')).status()).toBe(403)
  await other.context().close()

  expect((await post(page, '/system/mfa/lock')).status()).toBe(200)
  expect((await get(page, '/system/summary')).status()).toBe(403)
})

test('tela: primeiro acesso cadastra o app e mostra os códigos de recuperação', async ({ page }) => {
  await page.goto('/sistema')
  await expect(page.getByRole('heading', { name: 'Proteja o painel' })).toBeVisible()

  await page.locator('input[type=password]').fill('senha-errada')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByText('Senha incorreta.')).toBeVisible()

  await page.locator('input[type=password]').fill(E2E_SUPERADMIN.password)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByRole('img', { name: 'QR code do app autenticador' })).toBeVisible()
  const secret = (await page.locator('span.select-all').first().innerText()).trim()

  await page.getByPlaceholder('000000').fill(totpCode(secret))
  await page.getByRole('button', { name: 'Ativar' }).click()
  await expect(page.getByRole('heading', { name: 'Guarde os códigos de recuperação' })).toBeVisible()
  await expect(page.locator('span.select-all')).toHaveCount(8)

  const open = page.getByRole('button', { name: 'Abrir o painel' })
  await expect(open).toBeDisabled()
  await page.getByLabel('Guardei os códigos num lugar seguro').check()
  await open.click()
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible()
})

test('tela: pede o código, recusa o errado, abre com o certo e trava de novo', async ({ page }) => {
  const secret = await enrollSystemMfa()
  await page.goto('/sistema')
  await expect(page.getByRole('heading', { name: 'Confirme o acesso' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Salões' })).toHaveCount(0)

  await page.getByPlaceholder('000000').fill('111111')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('Código inválido.')).toBeVisible()

  await page.getByPlaceholder('000000').fill(totpCode(secret))
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Auditoria' })).toBeVisible()

  await page.getByRole('button', { name: 'Travar painel' }).click()
  await expect(page.getByRole('heading', { name: 'Confirme o acesso' })).toBeVisible()
})
