export const clienteAgendamentosSteps = [
  {
    id: 'filtro',
    title: 'Filtrar por status',
    text: 'Use os chips para ver só os agendamentos pendentes, confirmados, concluídos ou cancelados.',
    attachTo: { element: '[data-tour="agendamentos-filtro-cliente"]', on: 'bottom' },
  },
  {
    id: 'lista',
    title: 'Seus agendamentos',
    text: 'Clique em qualquer agendamento para ver os detalhes: serviço, profissional, horário e status.',
    attachTo: { element: '[data-tour="agendamentos-lista-cliente"]', on: 'top' },
  },
  {
    id: 'novo',
    title: 'Quer agendar?',
    text: 'Use o botão "Novo agendamento" para escolher serviço, profissional e horário disponível.',
    attachTo: { element: '[data-tour="agendamentos-novo-cliente"]', on: 'left' },
    buttons: [
      { text: 'Entendido!', action() { this.complete() }, classes: 'shepherd-btn-primary' },
    ],
  },
]
