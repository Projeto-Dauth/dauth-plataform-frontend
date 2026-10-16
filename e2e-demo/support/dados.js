import { SEED_USERS } from '../../e2e/support/session.js'
import { nextWeekday } from '../../e2e/support/dates.js'
import { demoSalon, serviceId, apiPost, createClient } from '../../e2e/support/demo.js'
import { createProfessional } from '../../e2e/support/team.js'
import { createPackage, sellAndPay } from '../../e2e/support/package.js'
import prisma from '../../e2e/support/db.js'

// Dados 100% genéricos para os vídeos: "Salão Exemplo", "Profissional 1..3", "Cliente 1..N",
// "Serviço 1..8", "Categoria 1..4" e valores redondos. O banco de teste é zerado a cada execução,
// então renomear o Salão Demo aqui não afeta nada fora da gravação.
const SALON_NAME = 'Salão Exemplo'
const SERVICES = [ // [nome no seed, nome genérico, minutos, preço]
  ['Corte Feminino', 'Serviço 1', 60, 100], ['Corte Masculino', 'Serviço 2', 30, 50],
  ['Escova', 'Serviço 3', 60, 80], ['Hidratação', 'Serviço 4', 90, 120],
  ['Manicure', 'Serviço 5', 45, 40], ['Pedicure', 'Serviço 6', 60, 50],
  ['Design Sobrancelha', 'Serviço 7', 30, 40], ['Limpeza de Pele', 'Serviço 8', 60, 90],
]
const CATEGORIES = [['Cabelo', 'Categoria 1'], ['Estética', 'Categoria 2'], ['Unhas', 'Categoria 3'], ['Sobrancelha', 'Categoria 4']]
const MIN = { 'Serviço 1': 60, 'Serviço 2': 30, 'Serviço 3': 60, 'Serviço 4': 90 }

const hhmm = (start, minutes) => {
  const [h, m] = start.split(':').map(Number)
  const t = h * 60 + m + minutes
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

// Dias usados nos roteiros (cada bloco de dados tem o seu, para os horários não colidirem)
export const days = () => ({ agenda: nextWeekday().iso, d1: nextWeekday(1).iso, d2: nextWeekday(2).iso, d3: nextWeekday(3).iso, d4: nextWeekday(4).iso })

async function attend(page, salon, { client, professional, service, day, start, status = 'concluido', pay = false }) {
  const end = hhmm(start, MIN[await serviceName(service)])
  const { data: [appt] } = await apiPost(page, salon.id, '/appointment/batch', {
    Client: client, Date: day, Items: [{ Professional: professional, Service: service, Start_time: start, End_time: end }],
  })
  const steps = status === 'concluido' ? ['confirmado', 'concluido'] : status === 'confirmado' ? ['confirmado'] : []
  for (const Status of steps) await apiPost(page, salon.id, `/appointment/${appt.UUID}`, { Status }, 'patch')
  if (pay) {
    const tab = await prisma.tab.findFirst({ where: { appointmentId: appt.UUID } })
    await apiPost(page, salon.id, '/tab/batch-pay', {
      tab_ids: [tab.id], client_id: client, Payment_date: new Date().toISOString(), Payments: [{ Method: 'pix', Amount: tab.value }],
    })
  }
  return appt.UUID
}
const serviceName = async (id) => (await prisma.service.findUnique({ where: { id } })).name

async function seed(page, salon) {
  // Nomes e valores genéricos
  await prisma.salon.update({ where: { id: salon.id }, data: { name: SALON_NAME } })
  await prisma.user.update({ where: { phone: SEED_USERS.owner.phone }, data: { name: 'Administrador' } })
  await prisma.user.update({ where: { phone: SEED_USERS.profissional.phone }, data: { name: 'Profissional 1' } })
  await prisma.user.update({ where: { phone: SEED_USERS.cliente.phone }, data: { name: 'Cliente 1' } })
  for (const [old, name, duration, price] of SERVICES) {
    await prisma.service.updateMany({ where: { salonId: salon.id, name: old }, data: { name, duration, price, commission: 40 } })
  }
  for (const [old, name] of CATEGORIES) await prisma.category.updateMany({ where: { salonId: salon.id, name: old }, data: { name } })

  const p1 = (await prisma.salonMember.findFirst({ where: { salonId: salon.id, user: { phone: SEED_USERS.profissional.phone } } })).id
  const p2 = (await createProfessional(salon.id, 'Profissional 2')).id
  const p3 = (await createProfessional(salon.id, 'Profissional 3')).id
  const cliente1 = (await prisma.salonMember.findFirst({ where: { salonId: salon.id, user: { phone: SEED_USERS.cliente.phone } } })).id
  const s = Object.fromEntries(await Promise.all(Object.keys(MIN).map(async (n) => [n, await serviceId(salon.id, n)])))
  const d = days()
  let n = 1
  const newClient = () => createClient(salon.id, `Cliente ${++n}`)

  // Agenda cheia no dia do roteiro
  await attend(page, salon, { client: await newClient(), professional: p1, service: s['Serviço 1'], day: d.agenda, start: '09:00', status: 'confirmado' }) // Cliente 2
  await attend(page, salon, { client: await newClient(), professional: p1, service: s['Serviço 3'], day: d.agenda, start: '11:00', status: 'pendente' }) // Cliente 3
  await attend(page, salon, { client: await newClient(), professional: p1, service: s['Serviço 2'], day: d.agenda, start: '14:00', status: 'confirmado' }) // Cliente 4
  await attend(page, salon, { client: await newClient(), professional: p2, service: s['Serviço 4'], day: d.agenda, start: '09:30', status: 'confirmado' }) // Cliente 5
  await attend(page, salon, { client: await newClient(), professional: p2, service: s['Serviço 1'], day: d.agenda, start: '13:00', status: 'pendente' }) // Cliente 6
  await attend(page, salon, { client: await newClient(), professional: p3, service: s['Serviço 3'], day: d.agenda, start: '10:00', status: 'confirmado' }) // Cliente 7
  await attend(page, salon, { client: await newClient(), professional: p3, service: s['Serviço 1'], day: d.agenda, start: '14:00', status: 'confirmado' }) // Cliente 8

  // Caixa: três comandas abertas (atendimentos concluídos, ainda sem pagamento) — Clientes 9 a 11
  await attend(page, salon, { client: await newClient(), professional: p1, service: s['Serviço 2'], day: d.d2, start: '09:00' })
  await attend(page, salon, { client: await newClient(), professional: p2, service: s['Serviço 3'], day: d.d2, start: '09:00' })
  await attend(page, salon, { client: await newClient(), professional: p3, service: s['Serviço 1'], day: d.d2, start: '09:00' })

  // Comissões a repassar: atendimentos já pagos — Clientes 12 a 15
  await attend(page, salon, { client: await newClient(), professional: p1, service: s['Serviço 1'], day: d.d3, start: '09:00', pay: true })
  await attend(page, salon, { client: await newClient(), professional: p1, service: s['Serviço 3'], day: d.d3, start: '11:00', pay: true })
  await attend(page, salon, { client: await newClient(), professional: p2, service: s['Serviço 1'], day: d.d3, start: '09:00', pay: true })
  await attend(page, salon, { client: await newClient(), professional: p3, service: s['Serviço 2'], day: d.d3, start: '09:00', pay: true })

  // Cliente 1 (a que usa o app): próximo atendimento, uma comanda paga e um pacote ativo
  await attend(page, salon, { client: cliente1, professional: p1, service: s['Serviço 1'], day: d.d1, start: '15:00', status: 'confirmado' })
  await attend(page, salon, { client: cliente1, professional: p1, service: s['Serviço 2'], day: d.d4, start: '09:00', pay: true })
  const pkg = await createPackage(page, salon, { name: 'Pacote 1', price: 400, items: [{ service: 'Serviço 1', quantity: 4, price: 100, commission: 40 }] })
  await sellAndPay(page, salon, pkg.id, cliente1)
}

// Garante os dados genéricos (uma vez por execução do servidor de teste) e devolve o que os roteiros usam.
// `page` precisa estar logado como o dono.
export async function ensureDemoData(page) {
  let salon = await demoSalon()
  if (salon.name !== SALON_NAME) { await seed(page, salon); salon = await demoSalon() }
  return { salon, days: days() }
}
