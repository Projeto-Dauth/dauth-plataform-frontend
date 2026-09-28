export const profissionalComandasSteps = [
  {
    id: 'comanda-origem',
    title: 'De onde vem a comanda?',
    text: 'Quando um atendimento seu é marcado como "Concluído", o sistema cria automaticamente uma comanda em aberto para o cliente pagar.',
    attachTo: { element: '[data-tour="comanda-lista"]', on: 'right' },
  },
  {
    id: 'comanda-pagamento',
    title: 'Registrar pagamento',
    text: 'Clique em uma comanda à esquerda, escolha o método de pagamento e confirme. A comanda passa para "Paga" e a comissão é registrada automaticamente.',
    attachTo: { element: '[data-tour="comanda-painel"]', on: 'left' },
  },
  {
    id: 'sub-abas',
    title: 'Serviços e Produtos',
    text: 'A aba "Serviços" mostra suas comandas de atendimento. A aba "Produtos" mostra pedidos de produtos vendidos por você.',
    attachTo: { element: '[data-tour="sub-abas"]', on: 'bottom' },
    buttons: [
      { text: 'Entendido!', action() { this.complete() }, classes: 'shepherd-btn-primary' },
    ],
  },
]
