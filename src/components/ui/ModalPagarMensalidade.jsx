import { useState } from 'react'
import Icon from '@/components/ui/Icons'
import Button from '@/components/ui/Button'
import { useToast } from '@/context/ToastContext'
import api from '@/lib/api'
import MoneyValue from '@/components/ui/MoneyValue'
import { formatCurrency } from '@/lib/format'
import { useAcceptedPaymentMethods } from '@/config/paymentMethods'

const SETTLE_METHODS = [
  { id: 'pix', icon: 'qr', label: 'Pix' },
  { id: 'dinheiro', icon: 'cash', label: 'Dinheiro' },
  { id: 'cartao_debito', icon: 'card', label: 'Débito' },
  { id: 'cartao_credito', icon: 'card', label: 'Crédito' },
]

export default function ModalPagarMensalidade({ client, items, total, onClose, onSuccess }) {
  const { addToast } = useToast()
  const [method, setMethod] = useState(null)
  const accepted = useAcceptedPaymentMethods()
  const [paying, setPaying] = useState(false)

  async function handleConfirm() {
    if (!method) return
    setPaying(true)
    try {
      await api.post('/transaction/fiado-settle', {
        client_id: client.client_id,
        client_name: client.client_name,
        transaction_ids: items.map(i => i.uuid),
        settlement_method: method,
        total_amount: total,
      })
      addToast(`Mensalidade de ${client.client_name} paga com sucesso!`, 'success')
      onSuccess()
    } catch {
      addToast('Erro ao registrar pagamento. Tente novamente.', 'error')
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm px-0 md:px-4">
      <div className="w-full md:max-w-[500px] bg-surface rounded-t-2xl md:rounded-[16px] shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-line shrink-0">
          <div className="flex-1 min-w-0">
            <h4 className="font-display font-medium text-[15px] text-ink">Pagar mensalidade</h4>
            <p className="text-[12px] text-ink-3 mt-0.5 truncate">{client.client_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-ink-4 hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">
          <div className="space-y-2 mb-4">
            <div className="grid grid-cols-[1fr_5rem_5rem] gap-x-3 pb-1.5 mb-0.5 border-b border-line-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-4">Serviço</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-4 text-right">Data</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-4 text-right">Valor</span>
            </div>
            {items.map(item => (
              <div key={item.uuid} className="grid grid-cols-[1fr_5rem_5rem] gap-x-3 items-center text-[13px] py-1">
                <span className="text-ink-2 truncate">{item.servico}</span>
                <span className="font-mono text-[11px] text-ink-4 text-right">
                  {item.appointment_date
                    ? item.appointment_date.split('-').reverse().join('/')   // data pura: new Date() recuaria um dia (UTC)
                    : item.payment_date
                      ? new Date(item.payment_date).toLocaleDateString('pt-BR')
                      : '—'}
                </span>
                <span className="font-mono font-medium text-ink text-right"><MoneyValue>{formatCurrency(item.gross_amount)}</MoneyValue></span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-3 border-t border-dashed border-line-2">
              <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">Total</span>
              <span className="font-display text-[20px] font-medium text-warning"><MoneyValue>{formatCurrency(total)}</MoneyValue></span>
            </div>
          </div>

          <p className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4 mb-2">Forma de pagamento</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SETTLE_METHODS.filter(m => accepted.includes(m.id)).map(m => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`px-3 py-2.5 rounded-[10px] border flex flex-col items-center gap-1 text-[12px] cursor-pointer transition-colors
                  ${method === m.id ? 'bg-ink text-bg border-ink' : 'bg-surface border-line hover:border-ink-3'}`}
              >
                <Icon name={m.icon} size={16} />
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-line shrink-0 flex gap-2">
          <button
            onClick={onClose}
            disabled={paying}
            className="flex-1 h-[42px] rounded-lg border border-line text-ink-2 text-[13px] font-medium hover:bg-surface-2 transition-colors cursor-pointer disabled:opacity-50">
            Cancelar
          </button>
          <Button loading={paying} disabled={!method} onClick={handleConfirm} className="flex-1">
            <Icon name="check" size={14} />
            Confirmar pagamento
          </Button>
        </div>
      </div>
    </div>
  )
}
