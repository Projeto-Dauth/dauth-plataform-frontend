// Formatação de exibição compartilhada (moeda, data, hora, duração, status de comanda).
// Antes cada tela tinha sua cópia, com variações — ao precisar formatar algo, importe daqui.

// R$ 1.234,56
export function formatCurrency(v) {
  return `R$ ${Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Como formatCurrency, mas valor ausente (null/undefined/'') vira `empty` em vez de R$ 0,00.
export function formatPrice(v, empty = '—') {
  if (v == null || v === '') return empty
  return formatCurrency(v)
}

// Data "pura" (sem horário): coluna DATE como string (AAAA-MM-DD, ex: Appointment.date) ou DateTime
// gravado à meia-noite UTC (ex: birthday). NÃO pode passar por new Date() + horário local: o JS lê como
// meia-noite UTC e no Brasil (UTC-3) exibiria o dia anterior.
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/

// DD/MM/AAAA. Data pura é fatiada da string; timestamp com horário é convertido para o dia local.
export function formatDate(v) {
  if (!v) return '—'
  const pure = typeof v === 'string' && DATE_ONLY_RE.exec(v)
  if (pure) return `${pure[3]}/${pure[2]}/${pure[1]}`
  return new Date(v).toLocaleDateString('pt-BR')
}

// DD/MM/AAAA às HH:MM (horário local)
export function formatDateTime(v) {
  if (!v) return '—'
  const d = new Date(v)
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// "HH:MM:SS" -> "HH:MM"
export function formatTime(t) {
  if (!t) return '—'
  return t.slice(0, 5)
}

// Date -> "AAAA-MM-DD" no fuso local (para filtros de período)
export function toLocalDateStr(date) {
  return date.toLocaleDateString('en-CA')
}

// Duração em minutos (number) ou "HH:MM[:SS]" -> "1h 30min" / "1h" / "45min"
export function formatDuration(d) {
  if (d == null || d === '') return ''
  const total = typeof d === 'number' ? d : (() => { const [h, m] = String(d).split(':').map(Number); return h * 60 + (m || 0) })()
  const h = Math.floor(total / 60), m = total % 60
  if (h > 0 && m > 0) return `${h}h ${m}min`
  if (h > 0) return `${h}h`
  return `${m}min`
}

// Status de comanda (Tab)
export function tabStatusLabel(s) {
  if (s === 'Pago') return 'Paga'
  return s
}

export function tabStatusVariant(s) {
  if (s === 'Em aberto') return 'warning'
  if (s === 'Paga' || s === 'Pago') return 'success'
  return 'danger'
}
