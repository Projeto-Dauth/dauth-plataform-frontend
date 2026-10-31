// Ponto de partida do editor do dashboard personalizado (Business): parecido com o dashboard padrão, montado só com
// o catálogo. Não é gravado sozinho — vira o layout do salão quando o Admin salva a primeira edição.
// Sem período aqui: todos os widgets seguem o filtro único do topo da página.
export const DEFAULT_DASHBOARD_WIDGETS = [
  { id: 'kpi-fat', type: 'kpi', title: 'Receita', query: { metric: 'faturamento', dimension: 'total' }, style: {}, x: 0, y: 0, w: 3, h: 2 },
  { id: 'kpi-atend', type: 'kpi', title: 'Atendimentos', query: { metric: 'atendimentos', dimension: 'total' }, style: {}, x: 3, y: 0, w: 3, h: 2 },
  { id: 'kpi-ticket', type: 'kpi', title: 'Ticket médio', query: { metric: 'ticket_medio', dimension: 'total' }, style: {}, x: 6, y: 0, w: 3, h: 2 },
  { id: 'kpi-cancel', type: 'kpi', title: 'Cancelamentos', query: { metric: 'cancelamentos', dimension: 'total' }, style: {}, x: 9, y: 0, w: 3, h: 2 },
  { id: 'area-fat-dia', type: 'area', title: 'Receita diária', query: { metric: 'faturamento', dimension: 'dia' }, style: {}, x: 0, y: 2, w: 8, h: 4 },
  { id: 'barra-servicos', type: 'barra', title: 'Top serviços', query: { metric: 'atendimentos', dimension: 'servico', limit: 5 }, style: {}, x: 8, y: 2, w: 4, h: 4 },
  { id: 'tabela-prof', type: 'tabela', title: 'Receita por profissional', query: { metric: 'faturamento', dimension: 'profissional' }, style: {}, x: 0, y: 6, w: 6, h: 4 },
  { id: 'pizza-pagto', type: 'pizza', title: 'Formas de pagamento', query: { metric: 'faturamento', dimension: 'metodo' }, style: {}, x: 6, y: 6, w: 6, h: 4 },
]
