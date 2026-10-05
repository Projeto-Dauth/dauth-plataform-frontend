// Grade da Agenda (Admin e Profissional): slots, posicionamento de agendamentos/folgas/intervalos e colunas.
// Slots de 30 em 30 min das 06:00 às 00:00
export const TIME_SLOTS = []
for (let h = 6; h < 24; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`)
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`)
}

const WEEK_DAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export const STATUS_STYLE = {
  pendente: { card: 'bg-[#dbeafe] border-[#93c5fd] text-[#1d4ed8]', dot: 'bg-[#3b82f6]' },
  confirmado: { card: 'bg-success-soft border-success/40 text-success', dot: 'bg-success' },
  concluido: { card: 'bg-[#faecd6] border-gold/50 text-[#7a5c2e]', dot: 'bg-gold' },
  cancelado: { card: 'bg-danger-soft border-danger/40 text-danger line-through opacity-60', dot: 'bg-danger' },
}

export function parseTime(t) {
  // "09:00:00+00" | "09:00:00-03" → "09:00"
  return t.slice(0, 5)
}

// Bloco fundido tem N serviços (Services[]) — junta os nomes; agendamento normal cai no
// fallback do campo singular Service.
export function serviceLabel(appt) {
  return appt.Services?.length > 0 ? appt.Services.map(s => s.Name).join(' + ') : appt.Service
}

export function serviceNames(appt) {
  return appt.Services?.length > 0 ? appt.Services.map(s => s.Name) : [appt.Service]
}

function toMinutes(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Um Appointment pode ter um "buraco" no meio de Services[] (ex: o serviço do meio foi
// reatribuído a outra profissional na edição — sai do bloco via Remove_services, mas
// Appointment.Start_time/End_time continuam sendo o menor início e o maior fim dos itens
// que sobraram, então ainda cobrem o horário do item removido). Sem isso, o bloco desenha
// um retângulo único e contínuo mostrando tempo ocioso que na verdade é de outra
// profissional. splitIntoSegments quebra o appt em N blocos visuais contíguos a partir dos
// horários reais de Services[]; sem buraco (ou sem Services[], formato singular antigo)
// continua virando 1 segmento só, idêntico ao comportamento anterior.
export function splitIntoSegments(appt) {
  if (!appt.Services?.length) return [appt]
  const sorted = [...appt.Services].sort((a, b) =>
    toMinutes(parseTime(a.Start_time ?? appt.Start_time)) - toMinutes(parseTime(b.Start_time ?? appt.Start_time))
  )
  const groups = []
  for (const s of sorted) {
    const start = s.Start_time ?? appt.Start_time
    const end = s.End_time ?? appt.End_time
    const last = groups[groups.length - 1]
    if (last && toMinutes(parseTime(start)) <= toMinutes(parseTime(last.End_time))) {
      last.Services.push(s)
      if (toMinutes(parseTime(end)) > toMinutes(parseTime(last.End_time))) last.End_time = end
    } else {
      groups.push({ Start_time: start, End_time: end, Services: [s] })
    }
  }
  if (groups.length <= 1) return [appt]
  // _original preserva o Appointment inteiro (Start_time/End_time/Services completos) —
  // ações que operam sobre o registro real (editar, excluir, mudar status, fechar comanda)
  // devem usar isso, não os campos truncados do segmento visual.
  return groups.map((g, i) => ({
    ...appt,
    Start_time: g.Start_time,
    End_time: g.End_time,
    Services: g.Services,
    _segKey: `${appt.UUID}::${i}`,
    _original: appt,
  }))
}

export function coversSlot(appt, slot) {
  const start = toMinutes(parseTime(appt.Start_time))
  const end = toMinutes(parseTime(appt.End_time))
  const s = toMinutes(slot)
  return s >= start && s < end
}

export function anchoredToSlot(appt, slot) {
  const startMin = toMinutes(parseTime(appt.Start_time))
  const slotMin = toMinutes(slot)
  return startMin >= slotMin && startMin < slotMin + 30
}

export function apptHeight(appt, cellH) {
  const startMin = toMinutes(parseTime(appt.Start_time))
  const endMin = toMinutes(parseTime(appt.End_time))
  return Math.max(cellH / 2 - 4, ((endMin - startMin) / 30) * cellH - 4)
}

export function apptTop(appt, slot, cellH) {
  const startMin = toMinutes(parseTime(appt.Start_time))
  const slotMin = toMinutes(slot)
  return ((startMin - slotMin) / 30) * cellH + 2
}

export function isSlotPast(date, slot) {
  const now = new Date()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (date < today) return true
  if (date > today) return false
  // mesmo dia — compara horário
  const [h, m] = slot.split(':').map(Number)
  return now.getHours() * 60 + now.getMinutes() > h * 60 + m
}

export function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function formatHeader(date) {
  const dow = WEEK_DAYS[date.getDay()]
  const d = date.getDate()
  const mon = MONTHS[date.getMonth()]
  const year = date.getFullYear()
  return `${dow.charAt(0).toUpperCase() + dow.slice(1)}, ${d} de ${mon} de ${year}`
}

export function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function isBreakStart(wh, slot) {
  return wh?.Break_start && wh.Break_start.slice(0, 5) === slot
}

export function coversBreak(wh, slot) {
  if (!wh?.Break_start || !wh?.Break_end) return false
  const s = toMinutes(slot)
  return s >= toMinutes(wh.Break_start.slice(0, 5)) && s < toMinutes(wh.Break_end.slice(0, 5))
}

export function spanBreak(wh) {
  if (!wh?.Break_start || !wh?.Break_end) return 0
  return Math.max(1, Math.ceil((toMinutes(wh.Break_end.slice(0, 5)) - toMinutes(wh.Break_start.slice(0, 5))) / 30))
}

// Helpers para folgas
export function leaveCoversSlot(leaves, slot) {
  if (!leaves?.length) return false
  return leaves.some(l => {
    if (l.All_day) return true
    if (!l.Start_time || !l.End_time) return false
    const s = toMinutes(slot)
    return s >= toMinutes(l.Start_time.slice(0, 5)) && s < toMinutes(l.End_time.slice(0, 5))
  })
}

export function leaveStartsAt(leaves, slot) {
  if (!leaves?.length) return null
  if (leaves.some(l => l.All_day) && slot === TIME_SLOTS[0]) return leaves.find(l => l.All_day)
  const slotMin = toMinutes(slot)
  return leaves.find(l => {
    if (l.All_day || !l.Start_time) return false
    const startMin = toMinutes(l.Start_time.slice(0, 5))
    return startMin >= slotMin && startMin < slotMin + 30
  }) ?? null
}

export function leaveTop(leave, slot, cellH) {
  if (leave.All_day || !leave.Start_time) return 2
  const startMin = toMinutes(leave.Start_time.slice(0, 5))
  const slotMin = toMinutes(slot)
  return ((startMin - slotMin) / 30) * cellH + 2
}

export function leaveHeight(leave, cellH) {
  if (leave.All_day) return TIME_SLOTS.length * cellH - 4
  if (!leave.Start_time || !leave.End_time) return cellH - 4
  const startMin = toMinutes(leave.Start_time.slice(0, 5))
  const endMin = toMinutes(leave.End_time.slice(0, 5))
  return Math.max(cellH / 2 - 4, ((endMin - startMin) / 30) * cellH - 4)
}

// Calcula coluna e total de colunas para agendamentos sobrepostos de um profissional
export function computeColumns(appts) {
  const sorted = [...appts].sort((a, b) =>
    toMinutes(parseTime(a.Start_time)) - toMinutes(parseTime(b.Start_time))
  )
  const colEnds = [] // minuto de fim do último agendamento em cada coluna
  const colMap = new Map() // segKey (ou UUID) → { col, start, end }

  sorted.forEach(appt => {
    const key = appt._segKey ?? appt.UUID
    const start = toMinutes(parseTime(appt.Start_time))
    const end = toMinutes(parseTime(appt.End_time))
    let col = colEnds.findIndex(e => e <= start)
    if (col === -1) { col = colEnds.length; colEnds.push(end) }
    else colEnds[col] = end
    colMap.set(key, { col, start, end })
  })

  // totalCols = maior índice de coluna entre todos os sobrepostos + 1
  const result = new Map()
  colMap.forEach((data, uuid) => {
    let maxCol = data.col
    colMap.forEach((other, otherUuid) => {
      if (uuid !== otherUuid && other.start < data.end && other.end > data.start) {
        maxCol = Math.max(maxCol, other.col)
      }
    })
    result.set(uuid, { col: data.col, totalCols: maxCol + 1 })
  })
  return result
}
