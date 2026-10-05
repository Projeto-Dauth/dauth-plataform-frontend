import { SEED_SALON_SLUG } from '../../../backend/prisma/seedUsers.js'

// Agenda do Admin (/:slug/admin) — abrir um dia e a gaveta de "Novo agendamento".

export async function openAgendaOn(page, iso) {
  await page.goto(`/${SEED_SALON_SLUG}/admin`)
  await page.getByLabel('Ir para a data').fill(iso)
}

// Clica no horário livre da profissional e devolve a gaveta aberta
export async function openNewAppointment(page, time, professionalName) {
  await page.getByRole('button', { name: `Agendar ${time} com ${professionalName}` }).click()
  return page.locator('div')
    .filter({ has: page.getByRole('heading', { name: 'Novo agendamento' }) })
    .filter({ has: page.getByRole('button', { name: 'Confirmar agendamento' }) })
    .last()
}

// Campo com busca (SearchableSelect): `trigger` é o botão do campo (mostra o placeholder ou o valor atual)
export async function pick(trigger, optionText, search = optionText) {
  await trigger.click()
  const field = trigger.locator('xpath=..')
  await field.getByPlaceholder('Buscar…').fill(search)
  await field.locator('li', { hasText: optionText }).first().click()
}

// Horários do item `index` (0 = primeiro serviço) na gaveta
export async function setItemTimes(drawer, index, start, end) {
  const times = drawer.locator('input[type="time"]')
  await times.nth(index * 2).fill(start)
  if (end) await times.nth(index * 2 + 1).fill(end)
}
