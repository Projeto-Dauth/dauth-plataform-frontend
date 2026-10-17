import { test, expect } from '@playwright/test'
import { SEED_USERS, loginAs } from '../e2e/support/session.js'
import { createSalon } from '../e2e/support/salon.js'
import prisma from '../e2e/support/db.js'
import { Recorder, say, glide, tap, pause } from './support/kit.js'

// Vídeo 8 — Configurações do salão (código de acesso, agendamento online, pagamentos) e o plano.
// Salão próprio (em trial): o que o roteiro liga/desliga não afeta os outros vídeos.
test('08 · configurações e planos', async ({ browser, page }) => {
  await loginAs(page, SEED_USERS.owner)
  const salon = await createSalon(page, 'Salão Exemplo')
  await prisma.user.update({ where: { phone: SEED_USERS.owner.phone }, data: { name: 'Administrador' } }) // nome genérico, como nos outros vídeos
  const rec = new Recorder(browser, '08-configuracoes-planos')

  await rec.scene(SEED_USERS.owner, async (p, { ready }) => {
    await p.goto(`/${salon.slug}/admin/configuracoes`)
    await expect(p.getByRole('tab', { name: 'Geral' })).toBeVisible()
    await expect(p.getByLabel('Código de acesso do salão')).toBeVisible()
    ready() // a gravação passa a valer daqui: o sistema já está na tela

    await say(p, 'Em Configurações ficam todos os ajustes do salão, separados em abas')
    await glide(p, p.getByRole('tab', { name: 'Agendamento' }))
    await pause(p, 600)

    await say(p, 'Na aba Geral está o código de acesso do salão')
    await glide(p, p.getByLabel('Código de acesso do salão'))
    await say(p, 'Passe esse código para clientes e equipe entrarem no seu salão')
    await tap(p, p.getByRole('button', { name: 'Copiar' }), 900)
    await say(p, 'O fuso horário garante os horários certos no agendamento online')
    await glide(p, p.locator('select.cfg-input'))
    await pause(p, 1200)

    await tap(p, p.getByRole('tab', { name: 'Agendamento' }), 900)
    await say(p, 'Aqui você decide como o cliente agenda sozinho pelo link do salão')
    await glide(p, p.getByRole('switch', { name: 'Permitir agendamento online' }))
    await pause(p, 800)
    await say(p, 'Com a confirmação automática, o agendamento já entra confirmado')
    await tap(p, p.getByRole('switch', { name: 'Confirmar automaticamente' }), 900)
    await say(p, 'Não esqueça de salvar as alterações')
    await tap(p, p.getByRole('button', { name: 'Salvar alterações' }), 700)
    await expect(p.getByText('Todas as alterações estão salvas')).toBeVisible()
    await pause(p, 1200)

    await tap(p, p.getByRole('tab', { name: 'Pagamentos' }), 900)
    await say(p, 'Em Pagamentos, escolha as formas que o salão aceita')
    await glide(p, p.getByRole('switch').first())
    await say(p, 'Só as formas ligadas aparecem na hora de fechar a conta')
    await pause(p, 1800)

    await tap(p, p.getByRole('tab', { name: 'WhatsApp' }), 900)
    await say(p, 'O WhatsApp do salão faz parte dos planos pagos')
    await glide(p, p.getByText(/Disponível a partir do plano/))
    await pause(p, 1500)

    await tap(p, p.getByRole('tab', { name: 'Plano' }), 900)
    await say(p, 'Em Plano você acompanha o período de teste de 7 dias')
    await glide(p, p.getByText(/dias? de trial restantes?/))
    await pause(p, 1200)
    await say(p, 'Para continuar depois do teste, faça o upgrade')
    await tap(p, p.getByRole('button', { name: 'Fazer upgrade' }).first(), 1300)
    await say(p, 'Cada plano tem um limite de profissionais e recursos diferentes')
    await glide(p, p.getByRole('button', { name: /^Essencial/ }))
    await tap(p, p.getByRole('button', { name: /^Profissional/ }).first(), 1200)
    await tap(p, p.getByRole('button', { name: /Continuar com/ }), 1500)
    await expect(p.getByAltText('QR Code PIX')).toBeVisible()
    await say(p, 'O pagamento é por PIX e o plano é ativado na hora')
    await glide(p, p.getByAltText('QR Code PIX'))
    await pause(p, 1800)
    await say(p, '')
  })

  rec.build()
})
