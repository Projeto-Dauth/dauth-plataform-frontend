import { test, expect } from '@playwright/test'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from '../e2e/support/session.js'
import { Recorder, say, glide, tap, pickSlow, pause } from './support/kit.js'
import { ensureDemoData } from './support/dados.js'

// Vídeo 1 — A dona agenda um horário na agenda da equipe.
test('01 · agendamento', async ({ browser, page }) => {
  await loginAs(page, SEED_USERS.owner)
  const { days } = await ensureDemoData(page)
  const rec = new Recorder(browser, '01-agendamento')

  await rec.scene(SEED_USERS.owner, async (p, { ready }) => {
    await p.goto(`/${SEED_SALON_SLUG}/admin`)
    await p.getByLabel('Ir para a data').fill(days.agenda)
    await expect(p.getByRole('button', { name: /Cliente 2/ })).toBeVisible()
    ready() // a gravação passa a valer daqui: o sistema já está na tela

    await say(p, 'A agenda mostra toda a equipe, uma coluna para cada profissional', 3800)
    await glide(p, p.getByRole('button', { name: /Cliente 5/ }))
    await say(p, 'Em cada horário, o cliente e o serviço', 3200)
    await glide(p, p.getByRole('button', { name: /Cliente 7/ }))
    await pause(p, 1200)

    await say(p, 'Para agendar, é só clicar em um horário livre', 3000)
    await tap(p, p.getByRole('button', { name: 'Agendar 11:00 com Profissional 2' }), 1400)
    const d = p.locator('div')
      .filter({ has: p.getByRole('heading', { name: 'Novo agendamento' }) })
      .filter({ has: p.getByRole('button', { name: 'Confirmar agendamento' }) })
      .last()

    await say(p, 'Escolha o cliente...', 2200)
    await pickSlow(p, d.getByRole('button', { name: 'Selecionar cliente…' }), 'Cliente 9')
    await say(p, '...e o serviço', 2200)
    await pickSlow(p, d.getByRole('button', { name: 'Selecionar serviço…' }).first(), 'Serviço 2')
    await say(p, 'Início e fim já vêm preenchidos pela duração do serviço', 3600)
    await glide(p, d.locator('input[type="time"]').first())
    await pause(p, 1500)

    await tap(p, d.getByRole('button', { name: 'Confirmar agendamento' }), 600)
    await p.getByText('Agendamento criado!').waitFor()
    await say(p, 'Pronto! O horário já aparece na agenda', 3600)
    await glide(p, p.getByRole('button', { name: /Cliente 9/ }))
    await pause(p, 1800)
    await say(p, '', 400)
  })

  rec.build()
})
