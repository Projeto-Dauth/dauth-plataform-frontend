// Regras compartilhadas do Caixa (Admin) e Comandas (Profissional): filtros, períodos, métodos de pagamento e leitura de comanda.
import api from '@/lib/api'
import { toLocalDateStr } from '@/lib/format'

export const STATUS_FILTERS = ['Todos', 'Em aberto', 'Paga', 'Expirada']

export const PERIOD_PRESETS = [
  { key: 'todos', label: 'Todos' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mês' },
  { key: 'personalizado', label: 'Personalizado' },
]

function nowTimeStr() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

// Date/Start_time calculados no navegador (não no servidor) — evita o bug de fuso horário
// já documentado no projeto quando "agora" é calculado no backend. O backend usa isso pra
// também representar o serviço na Agenda da profissional (funde no agendamento dela se ela
// já atende essa comanda, ou cria um novo ligado por Booking_group) — ver
// tabController.addItem.
export function postAddService(tabId, serviceId, professionalId, confirmOverlap = false) {
  return api.post(`/tab/${tabId}/items`, {
    Item_type: 'service',
    Service_id: serviceId,
    Professional_id: professionalId,
    Quantity: 1,
    Date: toLocalDateStr(new Date()),
    Start_time: nowTimeStr(),
    Confirm_overlap: confirmOverlap,
  })
}

// Comanda não tem data própria — usa a data do agendamento quando existe (o caso comum);
// comandas sem Appointment (combo, ou comanda combinada sem Appointment direto) caem no
// Created_at da própria Tab, que é o fallback mais próximo do "quando essa comanda existiu".
export function tabDateStr(t) {
  return t.Appointment?.Date ?? t.Created_at?.slice(0, 10) ?? null
}

export function getPeriodRange(preset) {
  if (preset === 'todos' || preset === 'personalizado') return { from: null, to: null }

  const today = new Date()
  const to = toLocalDateStr(today)

  if (preset === 'semana') {
    const day = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((day + 6) % 7))
    return { from: toLocalDateStr(monday), to }
  }

  const start = new Date(today.getFullYear(), today.getMonth(), 1)
  return { from: toLocalDateStr(start), to }
}

export const PAY_METHODS = [
  { id: 'pix', icon: 'qr', label: 'Pix' },
  { id: 'dinheiro', icon: 'cash', label: 'Dinheiro' },
  { id: 'cartao_debito', icon: 'card', label: 'Débito' },
  { id: 'cartao_credito', icon: 'card', label: 'Crédito' },
]

export const PAY_METHODS_FIADO = { id: 'fiado', icon: 'clock', label: 'Mensalista — cobrar depois' }

export function isFiadoTab(t) {
  return (t.Transaction ?? []).some(tx => tx.Method === 'fiado')
}

export const isPaga = (status) => status === 'Paga' || status === 'Pago'

// Uma comanda paga em mais de uma forma tem N Transactions (o batch_pay_tabs cria uma por
// item por método), então ler só a primeira mostrava um método só e escondia o resto.
// Agrupa por forma de pagamento e soma o valor de cada uma.
export function paymentBreakdown(tab) {
  const byMethod = new Map()
  for (const tx of tab.Transaction ?? []) {
    // Gross 0 é sessão de pacote: a cliente pagou na compra do combo, não nesta comanda.
    if (Number(tx.Gross_amount) === 0) continue
    byMethod.set(tx.Method, (byMethod.get(tx.Method) ?? 0) + Number(tx.Gross_amount ?? 0))
  }
  return [...byMethod].map(([method, amount]) => ({ method, amount }))
}

export const PAYMENT_LABELS_PROD = { dinheiro: 'Dinheiro', pix: 'Pix', cartao_credito: 'Crédito', cartao_debito: 'Débito', fiado: 'Mensalista (fiado)' }
