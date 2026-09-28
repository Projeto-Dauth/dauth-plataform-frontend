export const profissionalSteps = [
  {
    id: 'sidebar',
    title: 'Navegação principal',
    text: 'Acesse sua agenda, agendamentos, comandas, produtos, comissões e horários pelo menu lateral.',
    attachTo: { element: '[data-tour="sidebar"]', on: 'right' },
  },
  {
    id: 'schedule-grid',
    title: 'Sua agenda',
    text: 'Aqui estão todos os seus atendimentos do dia. Os blocos coloridos indicam o status de cada agendamento.',
    attachTo: { element: '[data-tour="schedule-grid"]', on: 'top' },
  },
  {
    id: 'context-menu',
    title: 'Menu de ações',
    text: 'Clique com o botão direito (ou pressione e segure no celular) em um agendamento para confirmar, concluir, cancelar, abrir comanda ou transferir para outra data.',
    attachTo: { element: '[data-tour="schedule-grid"]', on: 'top' },
  },
  {
    id: 'comissoes',
    title: 'Minhas comissões',
    text: 'Acompanhe o histórico de repasses e o valor a receber por mês nesta seção.',
    attachTo: { element: '[data-tour="comissoes-link"]', on: 'right' },
    buttons: [
      { text: 'Entendido!', action() { this.complete() }, classes: 'shepherd-btn-primary' },
    ],
  },
]
