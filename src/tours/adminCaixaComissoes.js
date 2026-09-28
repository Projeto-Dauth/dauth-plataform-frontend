export const adminCaixaComissoesSteps = [
  {
    id: 'comissao-conceito',
    title: 'O que é comissão?',
    text: 'Cada serviço tem uma porcentagem de comissão configurada. Quando o pagamento é registrado, o valor da comissão do profissional é calculado automaticamente.',
    attachTo: { element: '[data-tour="comissoes-lista"]', on: 'right' },
  },
  {
    id: 'comissao-status',
    title: 'A repassar vs Repassado',
    text: '"A repassar" significa que o profissional ainda não recebeu a comissão. Após efetuar o repasse em dinheiro ou transferência, marque como "Repassado" para manter o controle.',
    attachTo: { element: '[data-tour="comissoes-lista"]', on: 'right' },
  },
  {
    id: 'comissao-mes',
    title: 'Filtro por mês',
    text: 'Use o seletor de mês e ano para visualizar comissões de períodos anteriores e manter o histórico de repasses organizado.',
    attachTo: { element: '[data-tour="comissoes-filtro"]', on: 'bottom' },
    buttons: [
      { text: 'Entendido!', action() { this.complete() }, classes: 'shepherd-btn-primary' },
    ],
  },
]
