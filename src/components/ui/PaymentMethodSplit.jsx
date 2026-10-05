import Icon from '@/components/ui/Icons'
import { formatCurrency } from '@/lib/format'
import { useAcceptedPaymentMethods } from '@/config/paymentMethods'

const METHOD_OPTIONS = [
  { id: 'pix', label: 'Pix' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'cartao_debito', label: 'Cartão débito' },
  { id: 'cartao_credito', label: 'Cartão crédito' },
  { id: 'fiado', label: 'Mensalista — cobrar depois' },
]

// Escolha de método(s) de pagamento — recebe `sp` (retorno de usePaymentSplit). Cada
// forma de pagamento é 1 linha: dropdown de método + (a partir da 2ª linha) campo de
// valor + botão de remover. Com 1 linha só (caso comum), não há campo de valor — o
// método escolhido cobre o total inteiro, igual ao seletor único de antes. Mensalista
// entra como mais uma opção do dropdown, mas só pode ser a única linha (a soma trava
// sozinha: escolher Mensalista com 2+ linhas na tela não é permitido pelo próprio
// dropdown, que desabilita a opção fora do caso de 1 linha só).
export default function PaymentMethodSplit({ sp }) {
  const accepted = useAcceptedPaymentMethods()
  const options = METHOD_OPTIONS.filter(m => accepted.includes(m.id) || sp.payments.some(p => p.method === m.id))
  return (
    <div role="group" aria-label="Formas de pagamento" className="space-y-2">
      {sp.payments.map((leg, legIndex) => {
        const usedByOthers = sp.payments.filter(p => p.id !== leg.id).map(p => p.method)
        return (
          <div key={leg.id} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <select
                aria-label={`Forma de pagamento ${legIndex + 1}`}
                value={leg.method}
                onChange={e => sp.setMethod(leg.id, e.target.value)}
                className="flex-1 h-9 px-2.5 rounded-md border border-line bg-surface text-ink-2 text-[13px] focus:outline-none focus:border-brand cursor-pointer"
              >
                {options.map(m => (
                  <option
                    key={m.id}
                    value={m.id}
                    disabled={usedByOthers.includes(m.id) || (m.id === 'fiado' && !sp.single)}
                  >
                    {m.label}
                  </option>
                ))}
              </select>

              {!sp.single && (
                <input
                  aria-label={`Valor da forma de pagamento ${legIndex + 1}`}
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={leg.amount}
                  onChange={e => sp.setAmount(leg.id, e.target.value.replace(/[^0-9.,]/g, ''))}
                  className="w-24 h-9 px-2 rounded-md border border-line bg-surface text-ink text-[13px] font-mono text-right focus:outline-none focus:border-brand shrink-0"
                />
              )}

              {sp.payments.length > 1 && (
                <button
                  type="button"
                  onClick={() => sp.removeLeg(leg.id)}
                  title="Remover esta forma de pagamento"
                  className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md text-ink-4 hover:text-danger hover:bg-danger-soft transition-colors cursor-pointer"
                >
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>

            {sp.trackCashTendered !== false && leg.method === 'dinheiro' && sp.legAmount(leg) > 0 && (
              <div className="flex items-center justify-end gap-2">
                <span className="text-[12.5px] text-ink-3">Valor recebido</span>
                <input
                  aria-label="Valor recebido"
                  type="text"
                  inputMode="decimal"
                  placeholder={formatCurrency(sp.legAmount(leg))}
                  value={leg.amountTendered}
                  onChange={e => sp.setAmountTendered(leg.id, e.target.value.replace(/[^0-9.,]/g, ''))}
                  className={`w-24 h-8 px-2 rounded border bg-surface text-ink text-[13px] font-mono text-right focus:outline-none focus:border-brand ${
                    sp.amountTenderedMissing ? 'border-danger' : 'border-line'
                  }`}
                />
              </div>
            )}
          </div>
        )
      })}

      {sp.canAddLeg && (
        <button
          type="button"
          onClick={sp.addLeg}
          className="text-[12.5px] text-brand hover:underline cursor-pointer"
        >
          + Adicionar forma de pagamento
        </button>
      )}

      {!sp.single && (
        <div className={`flex justify-between text-[12.5px] ${sp.sumValid ? 'text-ink-3' : 'text-danger'}`}>
          <span>{sp.remaining > 0 ? 'Falta alocar' : sp.remaining < 0 ? 'Sobrou' : 'Soma confere'}</span>
          {sp.remaining !== 0 && <span className="font-mono">{formatCurrency(Math.abs(sp.remaining))}</span>}
        </div>
      )}

      {sp.amountTenderedMissing && (
        <p className="text-[12.5px] text-danger">Informe o valor recebido para confirmar o pagamento em dinheiro.</p>
      )}
      {sp.trocoPreview > 0 && (
        <p className="text-[12.5px] text-brand">
          Troco de {formatCurrency(sp.trocoPreview)} vira crédito para o cliente (abate fiado em aberto primeiro, se houver).
        </p>
      )}
    </div>
  )
}
