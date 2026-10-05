export const MODULES = [
  { key: 'Caixa', label: 'Caixa' },
  { key: 'Agenda', label: 'Agenda' },
  { key: 'Clientes', label: 'Clientes' },
  { key: 'Comissoes', label: 'Comissões' },
  { key: 'Produtos', label: 'Produtos' },
  { key: 'Dashboard', label: 'Dashboard' },
  { key: 'Mensalistas', label: 'Mensalistas' },
]

// Conta de serviço (notebook do salão): só estes módulos (mirror de SERVICE_ACCOUNT_MODULES do backend).
export const SERVICE_ACCOUNT_MODULES = [
  { key: 'Agenda', label: 'Agenda' },
  { key: 'Caixa', label: 'Caixa' },
  { key: 'Clientes', label: 'Clientes' },
  { key: 'Servicos', label: 'Serviços e categorias' },
]

export const NAV_ITEM_MODULE = {
  'profissional': 'Agenda',
  'profissional/agendamentos': 'Agenda',
  'profissional/horarios': 'Agenda',
  'profissional/comandas': 'Caixa',
  'profissional/produtos': 'Produtos',
  'profissional/pedidos-produtos': 'Produtos',
  'profissional/comissoes': 'Comissoes',
  'admin/dashboard': 'Dashboard',
  'admin/caixa': 'Caixa',
  'admin/comissoes': 'Comissoes',
  'admin/mensalistas': 'Mensalistas',
  // Telas do Admin que a conta de serviço também usa (Admin sempre vê; Serviço depende do módulo)
  'admin': 'Agenda',
  'admin/agendamentos': 'Agenda',
  'admin/usuarios': 'Clientes',
  'admin/servicos': 'Servicos',
}
