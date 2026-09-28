export const clienteCombosSteps = [
  {
    id: 'abas',
    title: 'Meus combos e catálogo',
    text: '"Meus combos" mostra os pacotes que você já adquiriu com o progresso de sessões. "Explorar combos" mostra os pacotes disponíveis para compra.',
    attachTo: { element: '[data-tour="combos-abas"]', on: 'bottom' },
  },
  {
    id: 'progresso',
    title: 'Progresso de sessões',
    text: 'A barra mostra quantas sessões você já usou. As sessões são descontadas automaticamente quando um atendimento é marcado como concluído.',
    attachTo: { element: '[data-tour="combos-lista"]', on: 'top' },
    buttons: [
      { text: 'Entendido!', action() { this.complete() }, classes: 'shepherd-btn-primary' },
    ],
  },
]
