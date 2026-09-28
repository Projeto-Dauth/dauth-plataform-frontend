export const clienteSteps = [
  {
    id: 'next-appointment',
    title: 'Seu próximo atendimento',
    text: 'Aqui aparece seu próximo agendamento confirmado com data, horário e serviço.',
    attachTo: { element: '[data-tour="next-appointment"]', on: 'bottom' },
  },
  {
    id: 'agendar',
    title: 'Agendar horário',
    text: 'Use este botão para escolher um serviço, profissional e horário disponível.',
    attachTo: { element: '[data-tour="agendar-btn"]', on: 'right' },
  },
  {
    id: 'combos',
    title: 'Pacotes e combos',
    text: 'Se você tiver um combo ativo, o progresso das sessões e o saldo restante aparecem aqui.',
    attachTo: { element: '[data-tour="combos-card"]', on: 'top' },
    buttons: [
      { text: 'Entendido!', action() { this.complete() }, classes: 'shepherd-btn-primary' },
    ],
  },
]
