import { useEffect } from 'react'
import { useCreditAndTroco } from '@/hooks/useCreditAndTroco'
import { usePaymentSplit } from '@/hooks/usePaymentSplit'
import CreditToggleRow from '@/components/ui/CreditToggleRow'
import PaymentMethodSplit from '@/components/ui/PaymentMethodSplit'
import MoneyValue from '@/components/ui/MoneyValue'

function formatCurrency(v) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Composição de CreditToggleRow + PaymentMethodSplit usada por ModalFecharConta (bloco
// único, nessa ordem: crédito → "a cobrar" → divisão de método) — reporta pro pai via
// `onChange({ paymentBody, remainingAfterCredit, valid, isFiado })` a cada mudança. Os
// painéis de pagamento individual (TabComandas) usam useCreditAndTroco + usePaymentSplit
// + PaymentMethodSplit diretamente, em vez deste wrapper, porque posicionam os campos em
// lugares diferentes da tela.
export default function CreditAndTrocoFields({ clientId, total, resetKey, onChange }) {
  const cr = useCreditAndTroco({ clientId, total, resetKey })
  const sp = usePaymentSplit({ total: cr.remainingAfterCredit, resetKey })

  useEffect(() => {
    onChange?.({
      paymentBody: { ...sp.toRequestBody(), ...(cr.parsedCreditAmount > 0 ? { Credit_amount: cr.parsedCreditAmount } : {}) },
      remainingAfterCredit: cr.remainingAfterCredit,
      valid: sp.valid,
      isFiado: sp.isFiado,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cr.remainingAfterCredit, cr.parsedCreditAmount, sp.valid, sp.isFiado, JSON.stringify(sp.payments)])

  return (
    <>
      <CreditToggleRow cr={cr} />

      {cr.parsedCreditAmount > 0 && (
        <div className="flex items-center justify-between py-2 text-[14px]">
          <span className="text-ink-3">A cobrar de outra forma</span>
          <span className="font-mono font-medium text-ink"><MoneyValue>{formatCurrency(cr.remainingAfterCredit)}</MoneyValue></span>
        </div>
      )}

      <div className={cr.creditBalance > 0 ? 'pt-3 border-t border-dashed border-line-2' : ''}>
        <PaymentMethodSplit sp={sp} />
      </div>
    </>
  )
}
