import { test, expect } from '@playwright/test'
import { SEED_USERS, loginAs } from '../e2e/support/session.js'
import { createSalon } from '../e2e/support/salon.js'
import prisma from '../e2e/support/db.js'
import { createProfessional } from '../e2e/support/team.js'
import { Recorder, say, glide, tap, typeSlow, pause } from './support/kit.js'

// Vídeo 9 — Equipe: convidar profissional, conta de serviço (notebook do salão) e permissões por módulo.
// Salão próprio (em trial), para o convite e as permissões não afetarem os outros vídeos.
const SERVICE_PHONE = '(00) 9 1234-5678'
const SERVICE_PASSWORD = 'Servico@123'

test('09 · equipe, permissões e conta de serviço', async ({ browser, page }) => {
  await loginAs(page, SEED_USERS.owner)
  const salon = await createSalon(page, 'Salão Exemplo')
  await prisma.user.update({ where: { phone: SEED_USERS.owner.phone }, data: { name: 'Administrador' } }) // nome genérico, como nos outros vídeos
  const pro = await createProfessional(salon.id, 'Profissional 1')
  const member = await prisma.salonMember.findUnique({ where: { id: pro.id } })
  await prisma.user.update({ where: { id: member.userId }, data: { email: 'profissional1@exemplo.com' } }) // email genérico na lista
  const rec = new Recorder(browser, '09-equipe-permissoes')

  await rec.scene(SEED_USERS.owner, async (p, { ready }) => {
    await p.goto(`/${salon.slug}/admin/convidar-profissional`)
    await expect(p.getByRole('heading', { name: 'Profissionais', exact: true })).toBeVisible()
    await expect(p.getByText(/Trial · 1\/3 profissionais/)).toBeVisible()
    ready() // a gravação passa a valer daqui: o sistema já está na tela

    await say(p, 'Na tela Profissionais você monta a equipe do salão')
    await glide(p, p.getByText(/Trial · 1\/3 profissionais/))
    await say(p, 'O plano define quantos profissionais cabem — convites pendentes também ocupam vaga')
    await pause(p, 1000)

    await say(p, 'Para adicionar alguém, informe o nome e o email e envie o convite')
    await typeSlow(p, p.getByPlaceholder('Ex: Maria Oliveira'), 'Profissional 2')
    await typeSlow(p, p.getByPlaceholder('maria@exemplo.com'), 'profissional2@exemplo.com')
    await tap(p, p.getByRole('button', { name: 'Enviar convite' }), 900)
    await expect(p.getByText(/Convite enviado para/)).toBeVisible()
    await say(p, 'A pessoa recebe um link, cria a conta e entra na equipe')
    await glide(p, p.getByRole('button', { name: 'Reenviar' }))
    await say(p, 'Enquanto não aceita, o convite pode ser reenviado ou cancelado')
    await pause(p, 1500)

    const nome = p.getByLabel('Nome da conta de serviço')
    await say(p, 'A conta de serviço é para o computador que fica aberto na recepção')
    await glide(p, nome)
    await typeSlow(p, nome, 'Recepção')
    await say(p, 'Ela entra com um telefone próprio, que começa com (00), e uma senha')
    await p.getByLabel('Telefone da conta de serviço').fill(SERVICE_PHONE)
    await pause(p, 900)
    await p.getByLabel('Senha da conta de serviço').fill(SERVICE_PASSWORD)
    await pause(p, 900)
    await tap(p, p.getByRole('button', { name: 'Criar conta de serviço' }), 900)
    await expect(p.getByText(/Conta de serviço criada/)).toBeVisible()
    await say(p, 'Ela não ocupa vaga de profissional')
    await pause(p, 1500)

    await tap(p, p.getByRole('link', { name: 'Clientes', exact: true }), 1000)
    await say(p, 'As permissões de cada pessoa ficam na ficha dela, em Clientes')
    await typeSlow(p, p.getByPlaceholder('Buscar por nome ou telefone…'), 'Profissional 1')
    await tap(p, p.getByRole('row', { name: /Profissional 1/ }), 1200)
    await glide(p, p.getByRole('heading', { name: 'Permissões' }))
    await say(p, 'Desmarque o que a pessoa não deve ver. Aqui, o Caixa')
    await tap(p, p.getByLabel('Caixa: visualizar'), 900)
    await say(p, 'E salve. O Admin sempre tem acesso a tudo')
    await tap(p, p.getByRole('button', { name: 'Salvar permissões' }), 700)
    await expect(p.getByText('Permissões atualizadas com sucesso')).toBeVisible()
    await pause(p, 1500)
    await say(p, '')
  })

  await rec.scene({ phone: SERVICE_PHONE, password: SERVICE_PASSWORD }, async (p, { ready }) => {
    await p.goto('/meus-saloes')
    await expect(p.getByRole('button', { name: `Entrar em ${salon.name}` })).toBeVisible()
    ready()
    await say(p, 'Veja como fica a conta de serviço: ela entra pelo salão')
    await tap(p, p.getByRole('button', { name: `Entrar em ${salon.name}` }), 1500)
    await expect(p.getByRole('link', { name: 'Caixa', exact: true }).or(p.getByRole('button', { name: 'Caixa', exact: true })).first()).toBeVisible()
    await say(p, 'O menu mostra só Agenda, Clientes, Serviços e Caixa')
    await glide(p, p.getByRole('link', { name: 'Agenda', exact: true }).first())
    await glide(p, p.getByRole('link', { name: 'Clientes', exact: true }))
    await glide(p, p.getByRole('link', { name: 'Caixa', exact: true }).or(p.getByRole('button', { name: 'Caixa', exact: true })).first())
    await say(p, 'Comissões, Dashboard e Configurações ficam só com o Admin')
    await pause(p, 2200)
    await say(p, '')
  })

  rec.build()
})
