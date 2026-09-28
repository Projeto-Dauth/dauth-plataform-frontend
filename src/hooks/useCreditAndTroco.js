import { useState, useEffect } from 'react'
import api from '@/lib/api'

// Estado + cálculo do "usar crédito do cliente" — compartilhado entre ModalFecharConta e
// os painéis de pagamento individual (TabComandas em AdminCaixa/ProfissionalComandas).
// Troco/valor recebido em dinheiro saiu daqui — agora é responsabilidade de
// usePaymentSplit, porque passou a ser por perna de pagamento, não por comanda inteira.
//
// `resetKey` — muda quando o "alvo" do pagamento muda (ex: trocar de comanda selecionada)
// e precisa limpar useCredit/creditAmount; default = clientId.
export function useCreditAndTroco({ clientId, total, resetKey = clientId }) {
  const [creditBalance, setCreditBalance] = useState(0)
  const [useCredit, setUseCredit] = useState(false)
  const [creditAmount, setCreditAmount] = useState('')

  useEffect(() => {
    setUseCredit(false)
    setCreditAmount('')
    setCreditBalance(0)
    if (clientId) {
      api.get(`/users/${clientId}/credit-balance`)
        .then(({ data }) => setCreditBalance(data.balance ?? 0))
        .catch(() => setCreditBalance(0))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  const maxCreditUsable = Math.min(creditBalance, total)
  const parsedCreditAmount = useCredit ? Math.min(parseFloat(String(creditAmount).replace(',', '.')) || 0, maxCreditUsable) : 0
  const remainingAfterCredit = Number((total - parsedCreditAmount).toFixed(2))

  // `extra` é espalhado direto no body de POST /tab/batch-pay, então a chave tem que ser
  // exatamente o nome que o backend lê (`Credit_amount`). Com o nome errado o campo some
  // sem erro nenhum — o controller valida um objeto desestruturado do body, não o body
  // cru — e o pagamento falha com "valor insuficiente", já que o crédito nunca chegou lá.
  const extra = {}
  if (parsedCreditAmount > 0) extra.Credit_amount = parsedCreditAmount

  return {
    creditBalance, useCredit, setUseCredit, creditAmount, setCreditAmount, maxCreditUsable,
    parsedCreditAmount, remainingAfterCredit, extra,
  }
}
