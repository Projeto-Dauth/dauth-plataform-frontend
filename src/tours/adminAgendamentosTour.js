export const adminAgendamentosSteps = [
  {
    id: 'tabs',
    title: 'Três visões dos agendamentos',
    text: '"Ativos" reúne pendentes e confirmados — os que ainda vão acontecer. "Concluídos" e "Cancelados" são o histórico de atendimentos finalizados.',
    attachTo: { element: '[data-tour="agendamentos-tabs"]', on: 'bottom' },
  },
  {
    id: 'filtro-data',
    title: 'Filtrar por data',
    text: 'Use o seletor de data para ver os agendamentos de um dia específico. Deixe em branco para ver todos.',
    attachTo: { element: '[data-tour="agendamentos-filtro"]', on: 'bottom' },
  },
  {
    id: 'novo',
    title: 'Criar agendamento',
    text: 'Prefira criar agendamentos pela Agenda principal — lá você vê visualmente os horários disponíveis de cada profissional.',
    attachTo: { element: '[data-tour="agendamentos-novo"]', on: 'left' },
    buttons: [
      { text: 'Entendido!', action() { this.complete() }, classes: 'shepherd-btn-primary' },
    ],
  },
]
