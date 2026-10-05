import useSalonStore from '@/store/salonStore'

// Formas de pagamento que o salão pode aceitar do cliente (Admin → Configurações → Pagamentos).
// Mirror de PAYMENT_METHODS em backend/src/config/salonSettings.js. Crédito do cliente não entra aqui.
export const PAYMENT_METHODS = [
  { id: 'pix', label: 'Pix' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'cartao_debito', label: 'Cartão de débito' },
  { id: 'cartao_credito', label: 'Cartão de crédito' },
  { id: 'fiado', label: 'Mensalista (cobrar depois)' },
]

const ALL_IDS = PAYMENT_METHODS.map(m => m.id)

// Formas aceitas pelo salão atual. Salão ainda sem o campo no store (cache antigo) = todas.
export function useAcceptedPaymentMethods() {
  const accepted = useSalonStore(s => s.salon?.paymentMethods)
  return Array.isArray(accepted) && accepted.length ? accepted : ALL_IDS
}
