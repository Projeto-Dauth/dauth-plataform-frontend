import api from '@/lib/api'

// `wh` = registro de WorkingHours do profissional naquele dia da semana. Três estados:
//   objeto        → trabalha, no intervalo Start_time–End_time
//   null          → não cadastrou horário para o dia = não trabalha
//   UNKNOWN_HOURS → não deu pra saber (erro na busca). NUNCA afirmar nada nesse caso:
//                   dizer "não trabalha" por causa de uma falha de rede é pior que
//                   não dizer nada.
export const UNKNOWN_HOURS = 'unknown'

function toMin(t) {
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

// `undefined` (profissional ausente do mapa, ex: busca ainda em curso) conta como
// desconhecido, igual a UNKNOWN_HOURS — só `null` afirma "não trabalha".
export function outsideWorkingHours(wh, slot) {
  if (wh === UNKNOWN_HOURS || wh === undefined) return false
  if (!wh) return true
  const s = toMin(slot)
  return s < toMin(wh.Start_time) || s >= toMin(wh.End_time)
}

function rangeOutsideWorkingHours(wh, start, end) {
  if (wh === UNKNOWN_HOURS || wh === undefined) return false
  if (!wh) return true
  return toMin(start) < toMin(wh.Start_time) || toMin(end) > toMin(wh.End_time)
}

function rangeOverlapsBreak(wh, start, end) {
  if (wh === UNKNOWN_HOURS || wh === undefined || !wh) return false
  if (!wh.Break_start || !wh.Break_end) return false
  return toMin(start) < toMin(wh.Break_end) && toMin(end) > toMin(wh.Break_start)
}

function formatWorkingHours(wh) {
  return wh && wh !== UNKNOWN_HOURS ? `${wh.Start_time.slice(0, 5)}–${wh.End_time.slice(0, 5)}` : null
}

function formatBreak(wh) {
  return wh && wh !== UNKNOWN_HOURS && wh.Break_start && wh.Break_end
    ? `${wh.Break_start.slice(0, 5)}–${wh.Break_end.slice(0, 5)}`
    : null
}

// Texto do expediente exibido no cabeçalho da coluna do profissional na Agenda.
// `loaded=false` → string vazia, para não afirmar nada enquanto a busca não termina
// (inclusive ao trocar de dia, quando o estado ainda guarda o horário do dia anterior).
export function workingHoursLabel(wh, loaded = true) {
  if (!loaded) return ''
  if (wh === UNKNOWN_HOURS) return 'Horário indisponível'
  if (!wh) return 'Não trabalha hoje'
  return `Trabalha das ${wh.Start_time.slice(0, 5)} às ${wh.End_time.slice(0, 5)}`
}

// Busca o horário de cada profissional para um dia da semana (0=Dom … 6=Sáb).
// Retorna { [professionalId]: wh | null | UNKNOWN_HOURS } — nunca rejeita.
export async function fetchWorkingHours(professionalIds, weekday) {
  const results = await Promise.all(
    professionalIds.map(id =>
      api.get(`/working-hours/professional/${id}`)
        .then(({ data }) => [id, (data.data ?? []).find(w => w.Weekday === weekday) ?? null])
        .catch(() => [id, UNKNOWN_HOURS])
    )
  )
  return Object.fromEntries(results)
}

// Monta a mensagem do aviso para os itens que caem fora do expediente OU em cima do
// intervalo. items: [{ professionalId, professionalName, startTime, endTime }]
// whByProf: mapa vindo de fetchWorkingHours
export function buildOutsideHoursWarning(items, whByProf) {
  const lines = []

  for (const it of items) {
    const wh = whByProf[it.professionalId]
    const nome = it.professionalName || 'O profissional'

    if (rangeOutsideWorkingHours(wh, it.startTime, it.endTime)) {
      lines.push(wh
        ? `${nome} atende das ${formatWorkingHours(wh)} — o serviço das ${it.startTime} às ${it.endTime} está fora desse horário.`
        : `${nome} não trabalha neste dia — o serviço está marcado para ${it.startTime}.`)
    } else if (rangeOverlapsBreak(wh, it.startTime, it.endTime)) {
      lines.push(`${nome} tem intervalo das ${formatBreak(wh)} — o serviço das ${it.startTime} às ${it.endTime} avança sobre esse período.`)
    }
  }

  if (lines.length === 0) return null

  return `${lines.join('\n')}\n\nDeseja agendar mesmo assim?`
}
