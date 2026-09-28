export const adminSteps = [
  {
    id: 'sidebar',
    title: 'Navegação principal',
    text: 'Use o menu lateral para acessar Agenda, Agendamentos, Caixa, Combos, Usuários e Serviços.',
    attachTo: { element: '[data-tour="sidebar"]', on: 'right' },
  },
  {
    id: 'day-nav',
    title: 'Navegação de dia',
    text: 'Use as setas para avançar ou retroceder dias. O ícone de calendário abre um seletor de data.',
    attachTo: { element: '[data-tour="day-nav"]', on: 'bottom' },
  },
  {
    id: 'schedule-grid',
    title: 'Grade de horários',
    text: 'Cada coluna representa um profissional. Os blocos coloridos são agendamentos — clique em um slot vazio para criar um novo.',
    attachTo: { element: '[data-tour="schedule-grid"]', on: 'top' },
  },
  {
    id: 'context-menu',
    title: 'Menu de ações',
    text: 'Clique com o botão direito (ou pressione e segure no celular) em qualquer agendamento para confirmar, concluir, cancelar, abrir comanda ou transferir.',
    attachTo: { element: '[data-tour="schedule-grid"]', on: 'top' },
  },
  {
    id: 'notifications',
    title: 'Notificações',
    text: 'O sino exibe todas as atividades do sistema em tempo real — novos agendamentos, mudanças de status e mais.',
    attachTo: { element: '[data-tour="notifications"]', on: 'top' },
    buttons: [
      { text: 'Entendido!', action() { this.complete() }, classes: 'shepherd-btn-primary' },
    ],
  },
]
