import MoneyValue from '@/components/ui/MoneyValue'

function formatCurrency(v) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Campo "Valor recebido" (obrigatório em dinheiro) + preview de troco — recebe o objeto
// retornado por useCreditAndTroco(). Renderiza nada fora de Method='dinheiro' ou quando não
// sobra nada a cobrar (tudo já coberto pelo crédito).
export default function AmountTenderedField({ cr, method, topBorder = true }) {
  if (method !== 'dinheiro' || cr.remainingAfterCredit <= 0) return null

  return (
    <>
      <div className={`flex items-center justify-between gap-2 py-3 ${topBorder ? 'border-t border-dashed border-line-2' : ''}`}>
        <label className="text-[14px] font-medium text-ink-2">Valor recebido</label>
        <input
          type="text"
          inputMode="decimal"
          placeholder={formatCurrency(cr.remainingAfterCredit)}
          value={cr.amountTendered}
          onChange={e => cr.setAmountTendered(e.target.value.replace(/[^0-9.,]/g, ''))}
          className={`w-28 h-8 px-2 rounded border bg-surface text-ink text-[14px] font-mono text-right focus:outline-none focus:border-brand ${
            cr.amountTenderedMissing ? 'border-danger' : 'border-line'
          }`}
        />
      </div>
      {cr.amountTenderedMissing && (
        <p className="text-[12.5px] text-danger mb-1">Informe o valor recebido para confirmar o pagamento em dinheiro.</p>
      )}
      {cr.trocoPreview > 0 && (
        <p className="text-[12.5px] text-brand mb-1">
          Troco de <MoneyValue>{formatCurrency(cr.trocoPreview)}</MoneyValue> vira crédito para o cliente (abate fiado em aberto primeiro, se houver).
        </p>
      )}
    </>
  )
}
