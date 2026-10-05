import MoneyValue from '@/components/ui/MoneyValue'
import { formatCurrency, formatDate } from '@/lib/format'
import { isPaga, paymentBreakdown, PAYMENT_LABELS_PROD } from '@/lib/caixa'

export function TabPaymentInfo({ tab }) {
  if (!isPaga(tab.Status)) {
    return (
      <div className="rounded-lg px-4 py-3 text-[13px] text-center bg-danger-soft text-danger">
        Comanda expirada
      </div>
    )
  }
  const txs = tab.Transaction ?? []
  const isFiadoPendente = txs.some(tx => tx.Method === 'fiado' && tx.Payment === false)
  const methods = paymentBreakdown(tab)
  const paymentDate = txs.find(tx => tx.Payment_date)?.Payment_date
  const methodLabel = (m) => PAYMENT_LABELS_PROD[m.method] ?? m.method

  return (
    <div className={`rounded-lg px-4 py-3 text-[13px] text-center ${isFiadoPendente ? 'bg-warning/10 text-warning' : 'bg-success-soft text-success'}`}>
      {isFiadoPendente ? 'Registrada como mensalidade' : 'Pagamento confirmado'}
      <div className="mt-1 font-mono text-[11px] opacity-80">
        {methods.length > 1 ? (
          <>
            <div>{methods.map((m, i) => (
              <span key={m.method}>{i > 0 && ' · '}{methodLabel(m)} <MoneyValue>{formatCurrency(m.amount)}</MoneyValue></span>
            ))}</div>
            {paymentDate && <div>{formatDate(paymentDate)}</div>}
          </>
        ) : methods.length === 1
          ? `${methodLabel(methods[0])}${paymentDate ? ` · ${formatDate(paymentDate)}` : ''}${isFiadoPendente ? ' · aguardando quitação' : ''}`
          : txs.length > 0 || tab.Value === 0 ? 'Sessão de combo' : 'Sem transação registrada'}
      </div>
    </div>
  )
}
