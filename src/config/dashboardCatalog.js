// Espelho de exibição do catálogo do dashboard personalizado — fonte da verdade (e das validações) é
// backend/src/produto/config/dashboardMetrics.js. Ids e agrupamentos precisam ficar em sincronia.
export const METRICS = {
  faturamento:    { label: 'Faturamento',    unit: 'money', icon: 'cash',       dimensions: ['dia', 'mes', 'profissional', 'servico', 'metodo'] },
  comissoes:      { label: 'Comissões',      unit: 'money', icon: 'tag',        dimensions: ['dia', 'mes', 'profissional', 'servico'] },
  ticket_medio:   { label: 'Ticket médio',   unit: 'money', icon: 'receipt',    dimensions: ['dia', 'mes'] },
  atendimentos:   { label: 'Atendimentos',   unit: 'count', icon: 'cal',        dimensions: ['dia', 'mes', 'profissional', 'servico', 'status'] },
  cancelamentos:  { label: 'Cancelamentos',  unit: 'count', icon: 'alertCircle', dimensions: ['dia', 'mes', 'profissional', 'servico'] },
  clientes_novos: { label: 'Clientes novos', unit: 'count', icon: 'users',      dimensions: ['dia', 'mes'] },
}

export const DIMENSIONS = {
  total: 'Total', dia: 'Por dia', mes: 'Por mês', profissional: 'Por profissional', servico: 'Por serviço', metodo: 'Por forma de pagamento', status: 'Por status',
}

export const WIDGET_TYPES = {
  kpi: 'Número', area: 'Área', barra: 'Barras', linha: 'Linha', pizza: 'Pizza', tabela: 'Tabela',
}

// Cores do widget: 'brand' segue a paleta do salão; as demais são fixas (mesmos tons de gold/success/danger do sistema).
export const FIXED_COLORS = { gold: '#c9a57b', success: '#4a6b3e', danger: '#8b3a32' }

const toRgb = (color) => {
  if (color.startsWith('#')) return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
  return color.match(/\d+/g).slice(0, 3).map(Number) // "rgb(139 74 43)" ou "139 74 43"
}

// Cores que o olho não distingue (ex.: o tema Sage tem o mesmo verde da cor fixa; o Terracota é quase o vermelho).
// Usado para não oferecer/pintar duas vezes a mesma cor.
export const isSimilarColor = (a, b, tolerance = 45) => {
  const [r1, g1, b1] = toRgb(a), [r2, g2, b2] = toRgb(b)
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2) < tolerance
}
