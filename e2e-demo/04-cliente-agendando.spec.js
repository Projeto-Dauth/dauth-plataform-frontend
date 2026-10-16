import { test, expect } from '@playwright/test'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from '../e2e/support/session.js'
import { Recorder, say, tap, typeSlow, pause } from './support/kit.js'
import { ensureDemoData } from './support/dados.js'

// Vídeo 4 — A cliente agenda sozinha pelo link do salão (visão da cliente, sem login no começo).
test('04 · cliente agendando', async ({ browser, page }) => {
  await loginAs(page, SEED_USERS.owner)
  const { days } = await ensureDemoData(page)
  const [, , dia] = days.agenda.split('-').map(Number)
  const mesDiferente = days.agenda.slice(0, 7) !== new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7)
  const rec = new Recorder(browser, '04-cliente-agendando')

  await rec.scene(null, async (p, { ready }) => {
    const continuar = p.getByRole('button', { name: 'Continuar' })
    await p.goto(`/${SEED_SALON_SLUG}/agendar`)
    await expect(p.getByRole('button', { name: /Serviço 1/ })).toBeVisible()
    ready() // a gravação passa a valer daqui: o sistema já está na tela

    await say(p, 'O cliente acessa o link do salão e escolhe o serviço', 3600)
    await tap(p, p.getByRole('button', { name: /Serviço 1/ }), 1200)
    await tap(p, continuar, 1300)
    await say(p, 'Depois escolhe a profissional', 3000)
    await tap(p, p.getByRole('button', { name: /Profissional 1/ }), 1200)
    await tap(p, continuar, 1300)
    await say(p, 'Escolhe o dia e um horário livre', 3200)
    if (mesDiferente) await tap(p, p.getByRole('button', { name: 'Próximo mês' }), 900)
    await tap(p, p.getByRole('button', { name: String(dia), exact: true }), 1400)
    await tap(p, p.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first(), 1200)
    await tap(p, continuar, 1300)

    await say(p, 'Quem já tem conta entra com telefone e senha', 3400)
    const form = p.locator('form').filter({ has: p.getByRole('button', { name: 'Entrar' }) })
    await typeSlow(p, form.getByPlaceholder('(11) 9 8765-4321'), SEED_USERS.cliente.phone)
    await typeSlow(p, form.getByPlaceholder('Sua senha'), SEED_USERS.cliente.password)
    await tap(p, form.getByRole('button', { name: 'Entrar' }), 1500)

    await say(p, 'Confere os dados e confirma', 3000)
    await tap(p, p.getByRole('button', { name: 'Confirmar agendamento' }), 600)
    await expect(p.getByRole('heading', { name: 'Agendamento confirmado!' })).toBeVisible()
    await say(p, 'Pronto! Sem ligação e sem troca de mensagens', 4000)
    await say(p, '', 400)
  })

  rec.build()
})
