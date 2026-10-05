import { SEED_USERS } from '../../../backend/prisma/seedUsers.js'
import { serviceId, apiPost, createClient } from './demo.js'
import prisma from './db.js'

// Profissional novo no salão (só deste teste), direto no banco: conta + vínculo 'Profissional',
// com o mesmo expediente da Ana e todos os serviços dela. Para testes de comissão em que
// "Pagar todas" não pode pegar comissões criadas por outros testes.
export async function createProfessional(salonId, name = `Profissional E2E ${Date.now()}`) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const user = await prisma.user.create({
    data: {
      id: `e2e-pro-${stamp}`, name, email: `pro.${stamp}@e2e.test`, emailVerified: true,
      platformRole: 'Cliente', active: true, createdAt: new Date(), updatedAt: new Date(),
    },
  })
  const member = await prisma.salonMember.create({ data: { salonId, userId: user.id, role: 'Profissional', active: true } })
  // Em salão criado pelo teste não existe Ana: a profissional fica só com o vínculo.
  const ana = (await prisma.salonMember.findFirst({ where: { salonId, user: { phone: SEED_USERS.profissional.phone } } }))?.id
  if (!ana) return { id: member.id, name }
  const hours = await prisma.workingHours.findMany({ where: { memberId: ana } })
  await prisma.workingHours.createMany({
    data: hours.map(({ weekday, startTime, endTime, breakStart, breakEnd }) => ({ salonId, memberId: member.id, weekday, startTime, endTime, breakStart, breakEnd })),
  })
  const services = await prisma.serviceProfessional.findMany({ where: { memberId: ana }, select: { serviceId: true } })
  await prisma.serviceProfessional.createMany({ data: services.map(s => ({ serviceId: s.serviceId, memberId: member.id })) })
  return { id: member.id, name }
}

// Atendimento concluído e cobrado (Pix) pela API: devolve a comanda, o item de serviço e a
// Transaction principal (a que carrega a comissão da profissional).
export async function paidAttendance(page, salon, { professional, day, start = '09:00', end = '09:30', service = 'Corte Masculino', assistant, clientName } = {}) {
  clientName ??= `Cliente Comissão ${Date.now()}`
  const client = await createClient(salon.id, clientName)
  const { data: [appt] } = await apiPost(page, salon.id, '/appointment/batch', {
    Client: client, Date: day,
    Items: [{ Professional: professional, Service: await serviceId(salon.id, service), Start_time: start, End_time: end, ...(assistant ? { Assistant: assistant } : {}) }],
  })
  for (const Status of ['confirmado', 'concluido']) await apiPost(page, salon.id, `/appointment/${appt.UUID}`, { Status }, 'patch')
  const tab = await prisma.tab.findFirst({ where: { appointmentId: appt.UUID } })
  await apiPost(page, salon.id, '/tab/batch-pay', {
    tab_ids: [tab.id], client_id: client, Payment_date: new Date().toISOString(), Payments: [{ Method: 'pix', Amount: tab.value }],
  })
  const item = await prisma.tabItem.findFirst({ where: { tabId: tab.id, itemType: 'service' } })
  const tx = await prisma.transaction.findFirst({ where: { tabItemId: item.id, assistantId: null } })
  return { client, clientName, appointmentId: appt.UUID, tabId: tab.id, itemId: item.id, tx }
}
