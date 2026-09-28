function formatCurrency(v) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Resume, numa frase só, o que aconteceu de crédito/troco num POST /tab/batch-pay —
// usado pelos 6 callers de ModalFecharConta pra anexar essa informação ao toast de sucesso.
export function batchPayExtraMessage(data) {
  const parts = []

  if (data.credit_used > 0) {
    parts.push(`${formatCurrency(data.credit_used)} pagos com crédito do cliente.`)
  }

  if (data.overpayment) {
    const { troco, fiado_offset } = data.overpayment
    if (fiado_offset) {
      const sobra = Number((troco - fiado_offset.amount).toFixed(2))
      parts.push(
        `Troco de ${formatCurrency(troco)}: ${formatCurrency(fiado_offset.amount)} abateram o fiado em aberto (${formatCurrency(fiado_offset.fiado_before)} → ${formatCurrency(fiado_offset.fiado_after)})`
        + (sobra > 0 ? `, ${formatCurrency(sobra)} viraram crédito.` : '.')
      )
    } else {
      parts.push(`Troco de ${formatCurrency(troco)} virou crédito para o cliente.`)
    }
  }

  return parts.length > 0 ? parts.join(' ') : null
}
