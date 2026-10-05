import { useState, useEffect } from 'react'
import { useAcceptedPaymentMethods } from '@/config/paymentMethods'

// Todos os métodos válidos, exceto crédito da cliente (esse é resolvido à parte por
// useCreditAndTroco, sempre "abatido primeiro" antes do valor entrar aqui).
const CASH_METHODS = ['pix', 'dinheiro', 'cartao_credito', 'cartao_debito']

let nextLegId = 0

function newLeg(method) {
  nextLegId += 1
  return { id: nextLegId, method, amount: '', amountTendered: '' }
}

// Gerencia a divisão do valor a cobrar (`total` = remainingAfterCredit, já com o crédito
// da cliente abatido) entre N métodos de pagamento — ex: metade Pix, metade Dinheiro.
// Enquanto houver 1 perna só, o comportamento é idêntico a hoje: o método escolhido cobre
// o total inteiro, sem precisar digitar nenhum valor. A partir da 2ª perna, cada uma
// precisa de um valor próprio, e a soma tem que bater com `total`.
// `initialPayments` ([{ Method, Amount }]) semeia as pernas com uma divisão que já existe —
// usado ao corrigir o valor de um item já pago, onde o ponto de partida é como ele foi pago
// da primeira vez. `trackCashTendered: false` desliga o campo de valor recebido/troco: numa
// correção de lançamento não há dinheiro novo trocando de mão, só o registro sendo acertado.
export function usePaymentSplit({ total, resetKey, initialPayments, trackCashTendered = true }) {
  // Só as formas que o salão aceita (Configurações → Pagamentos)
  const accepted = useAcceptedPaymentMethods()
  const cashMethods = CASH_METHODS.filter(m => accepted.includes(m))
  const defaultMethod = cashMethods[0] ?? 'fiado'
  const buildInitialLegs = () => (
    initialPayments?.length
      ? initialPayments.map(p => ({ ...newLeg(p.Method), amount: String(p.Amount ?? '') }))
      : [newLeg(defaultMethod)]
  )
  const [payments, setPayments] = useState(buildInitialLegs)

  useEffect(() => {
    setPayments(buildInitialLegs())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  const single = payments.length === 1
  const usedMethods = new Set(payments.map(p => p.method))
  const isFiado = payments.some(p => p.method === 'fiado')
  const availableMethods = cashMethods.filter(m => !usedMethods.has(m))
  const canAddLeg = single ? !isFiado && availableMethods.length > 0 : availableMethods.length > 0

  function legAmount(leg) {
    if (single) return total
    return parseFloat(String(leg.amount).replace(',', '.')) || 0
  }

  function addLeg() {
    if (!canAddLeg) return
    const method = availableMethods[0]
    setPayments(prev => [...prev.map(p => ({ ...p, amount: '' })), newLeg(method)])
  }

  function removeLeg(id) {
    setPayments(prev => {
      const next = prev.filter(p => p.id !== id)
      if (next.length === 0) return [newLeg(defaultMethod)]
      if (next.length === 1) return [{ ...next[0], amount: '' }]
      return next
    })
  }

  function setMethod(id, method) {
    setPayments(prev => prev.map(p => (p.id === id ? { ...p, method, amountTendered: method === 'dinheiro' ? p.amountTendered : '' } : p)))
  }

  function setAmount(id, value) {
    setPayments(prev => prev.map(p => (p.id === id ? { ...p, amount: value } : p)))
  }

  function setAmountTendered(id, value) {
    setPayments(prev => prev.map(p => (p.id === id ? { ...p, amountTendered: value } : p)))
  }

  const allocated = single ? total : payments.reduce((s, p) => s + legAmount(p), 0)
  const remaining = Number((total - allocated).toFixed(2))
  const sumValid = single || Math.abs(remaining) < 0.01

  const dinheiroLeg = trackCashTendered ? payments.find(p => p.method === 'dinheiro') : undefined
  let amountTenderedMissing = false
  let trocoPreview = 0
  if (dinheiroLeg) {
    const amount = legAmount(dinheiroLeg)
    const tendered = parseFloat(String(dinheiroLeg.amountTendered).replace(',', '.'))
    amountTenderedMissing = amount > 0 && !(Number.isFinite(tendered) && tendered >= amount)
    if (amount > 0 && Number.isFinite(tendered) && tendered > amount) {
      trocoPreview = Number((tendered - amount).toFixed(2))
    }
  }

  const valid = sumValid && !amountTenderedMissing

  function toRequestBody() {
    const body = {
      Payments: payments.map(p => ({ Method: p.method, Amount: legAmount(p) })),
    }
    if (dinheiroLeg) {
      const tendered = parseFloat(String(dinheiroLeg.amountTendered).replace(',', '.'))
      if (Number.isFinite(tendered) && tendered > 0) body.Amount_tendered = tendered
    }
    return body
  }

  return {
    payments, single, isFiado, canAddLeg, availableMethods, trackCashTendered,
    legAmount, addLeg, removeLeg, setMethod, setAmount, setAmountTendered,
    allocated, remaining, sumValid, dinheiroLeg, amountTenderedMissing, trocoPreview,
    valid, toRequestBody,
  }
}
