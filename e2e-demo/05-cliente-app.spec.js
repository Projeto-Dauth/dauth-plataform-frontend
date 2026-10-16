import { test, expect } from '@playwright/test'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from '../e2e/support/session.js'
import { Recorder, say, glide, goTo, pause } from './support/kit.js'
import { ensureDemoData } from './support/dados.js'

// Vídeo 5 — O cliente usando o app: início, agendamentos, combos (pacotes) e comandas.
test('05 · cliente usando o app', async ({ browser, page }) => {
  await loginAs(page, SEED_USERS.owner)
  await ensureDemoData(page)
  const rec = new Recorder(browser, '05-cliente-app')
  const base = `/${SEED_SALON_SLUG}/cliente`

  await rec.scene(SEED_USERS.cliente, async (p, { ready }) => {
    await p.goto(base)
    await expect(p.getByText('Serviço 1').first()).toBeVisible()
    ready() // a gravação passa a valer daqui: o sistema já está na tela

    await say(p, 'Na tela inicial, o próximo atendimento', 3600)
    await glide(p, p.getByText('Serviço 1').first())
    await pause(p, 1800)

    await goTo(p, 'Meus agendamentos', `${base}/agendamentos`)
    await say(p, 'Todos os agendamentos, com a situação de cada um', 3800)
    await pause(p, 1800)

    await goTo(p, 'Meus combos', `${base}/combos`)
    await say(p, 'Os pacotes comprados e quantas sessões ainda restam', 4000)
    await glide(p, p.getByText('Pacote 1').first())
    await pause(p, 1800)

    await goTo(p, 'Minhas comandas', `${base}/comandas`)
    await say(p, 'E o histórico de tudo o que já foi pago', 3800)
    await pause(p, 1800)

    await say(p, '', 400)
  })

  rec.build()
})
