import { test, expect } from '@playwright/test'
import { SEED_USERS, SEED_SALON_SLUG, loginAs } from '../e2e/support/session.js'
import { Recorder, say, glide, goTo, pause } from './support/kit.js'
import { ensureDemoData } from './support/dados.js'

// Vídeo 6 — Visão da profissional: agenda dela, agendamentos, comandas e comissões.
test('06 · profissional', async ({ browser, page }) => {
  await loginAs(page, SEED_USERS.owner)
  const { days } = await ensureDemoData(page)
  const rec = new Recorder(browser, '06-profissional')
  const base = `/${SEED_SALON_SLUG}/profissional`

  await rec.scene(SEED_USERS.profissional, async (p, { ready }) => {
    await p.goto(base)
    // A agenda abre em hoje: avança com a seta até o dia da demonstração (antes do cartão de título)
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    const dias = Math.round((Date.parse(`${days.agenda}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000)
    const botaoHoje = p.getByRole('button', { name: 'Hoje', exact: true })
    await botaoHoje.waitFor()
    // botões sem nome depois de "Ver todos": [1] dia anterior, [2] próximo dia, [3] calendário
    const proximo = p.getByRole('button', { name: 'Ver todos' }).locator('xpath=following::button[2]')
    for (let i = 0; i < dias; i++) await proximo.click()
    await expect(p.getByRole('button', { name: /Cliente 2/ })).toBeVisible()
    ready() // a gravação passa a valer daqui: o sistema já está na tela

    await say(p, 'A agenda mostra só os atendimentos dela', 3600)
    await glide(p, p.getByRole('button', { name: /Cliente 2/ }))
    await pause(p, 1500)
    await glide(p, p.getByRole('button', { name: /Cliente 4/ }))
    await pause(p, 1500)

    await goTo(p, 'Agendamentos', `${base}/agendamentos`)
    await say(p, 'Lista dos agendamentos, para acompanhar e atualizar o status', 4000)
    await pause(p, 1600)

    await goTo(p, 'Comandas', `${base}/comandas`)
    await say(p, 'As comandas dos clientes atendidos por ela', 3800)
    await pause(p, 1600)

    await goTo(p, 'Minhas comissões', `${base}/comissoes`)
    await say(p, 'E as comissões: cada atendimento com o valor que ela recebe', 4200)
    await pause(p, 2200)

    await say(p, '', 400)
  })

  rec.build()
})
