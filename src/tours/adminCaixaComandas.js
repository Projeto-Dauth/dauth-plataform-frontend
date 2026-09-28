export const adminCaixaComandasSteps = [
  {
    id: 'caixa-tabs',
    title: 'Abas do Caixa',
    text: 'O Caixa tem 4 seções: Comandas (pagamentos de serviços), Produtos (pedidos), Comissões (repasses) e Relatório (fechamento por período).',
    attachTo: { element: '[data-tour="caixa-tabs"]', on: 'bottom' },
  },
  {
    id: 'comanda-origem',
    title: 'Como surge uma comanda?',
    text: 'Quando um agendamento é marcado como "Concluído" na agenda, o sistema gera automaticamente uma comanda em aberto para aquele serviço.',
    attachTo: { element: '[data-tour="comanda-lista"]', on: 'right' },
  },
  {
    id: 'comanda-pagamento',
    title: 'Registrar pagamento',
    text: 'Clique em uma comanda à esquerda para abrir o painel de pagamento. Selecione o método (Pix, Dinheiro, Débito ou Crédito) e confirme.',
    attachTo: { element: '[data-tour="comanda-painel"]', on: 'left' },
  },
  {
    id: 'fechar-conta',
    title: 'Fechar conta por cliente',
    text: 'Quando um cliente tem comandas em aberto, o botão "Fechar conta" aparece no topo. Ele paga todos os serviços e produtos pendentes de uma vez.',
    attachTo: { element: '[data-tour="caixa-tabs"]', on: 'bottom' },
    buttons: [
      { text: 'Entendido!', action() { this.complete() }, classes: 'shepherd-btn-primary' },
    ],
  },
]
