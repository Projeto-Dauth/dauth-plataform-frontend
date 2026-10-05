// Próximo dia útil a partir de amanhã, no fuso do salão (a Ana do seed atende de segunda a sexta),
// opcionalmente N semanas à frente (mesmo dia da semana) — para testes que precisam de um dia só seu.
export function nextWeekday(weeksAhead = 0) {
  const todaySP = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) // AAAA-MM-DD
  const date = new Date(`${todaySP}T12:00:00Z`)
  do date.setUTCDate(date.getUTCDate() + 1)
  while ([0, 6].includes(date.getUTCDay()))
  date.setUTCDate(date.getUTCDate() + 7 * weeksAhead)
  return {
    iso: date.toISOString().slice(0, 10), // AAAA-MM-DD
    day: date.getUTCDate(),
    monthChanged: date.getUTCMonth() !== Number(todaySP.slice(5, 7)) - 1,
  }
}

export function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
