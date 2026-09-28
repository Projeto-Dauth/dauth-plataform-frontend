import MoneyValue from '@/components/ui/MoneyValue'

function formatCurrency(v) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Linha "Crédito R$X disponível" + checkbox pra usar — recebe o objeto retornado por
// useCreditAndTroco(). Renderiza nada quando o cliente não tem saldo. `editable=false`
// (painel de Comandas) tira o input de valor — sempre usa o máximo disponível
// (min(saldo, total)), sem permitir digitar um valor parcial ali.
export default function CreditToggleRow({ cr, className = 'py-3.5 border-b border-dashed border-line-2', editable = true }) {
  if (cr.creditBalance <= 0) return null

  return (
    <label className={`flex items-center justify-between gap-2 cursor-pointer ${className}`}>
      <span className="flex items-center gap-2.5 text-[14px] font-medium text-ink-2">
        <input
          type="checkbox"
          checked={cr.useCredit}
          onChange={e => {
            cr.setUseCredit(e.target.checked)
            if (e.target.checked) cr.setCreditAmount(String(cr.maxCreditUsable))
          }}
          className="w-4 h-4"
        />
        Crédito (<MoneyValue>{formatCurrency(cr.creditBalance)}</MoneyValue> disponível)
      </span>
      {cr.useCredit && editable && (
        <input
          type="text"
          inputMode="decimal"
          value={cr.creditAmount}
          onChange={e => cr.setCreditAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
          onClick={e => e.stopPropagation()}
          className="w-24 h-8 px-2 rounded border border-line bg-surface text-ink text-[14px] font-mono text-right focus:outline-none focus:border-brand"
        />
      )}
    </label>
  )
}
