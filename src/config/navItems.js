import { NAV_ITEM_MODULE } from './modules'

// Paths are relative (no leading /) — Sidebar prepends /${salonSlug}/
export const navItemsByRole = {
  Admin: [
    { to: 'admin/dashboard', end: true, icon: 'chart', label: 'Dashboard' },
    { type: 'label', label: 'Operação' },
    { to: 'admin', end: true, icon: 'cal', label: 'Agenda' },
    { to: 'admin/agendamentos', icon: 'receipt', label: 'Agendamentos' },
    { to: 'admin/usuarios', icon: 'users', label: 'Clientes' },
    { to: 'admin/servicos', icon: 'scissors', label: 'Serviços', children: [
      { to: 'admin/servicos', label: 'Serviços' },
      { to: 'admin/servicos?tab=categorias', label: 'Categorias' },
    ]},
    { to: 'admin/combos', icon: 'package', label: 'Pacotes' },
    { to: 'admin/convidar-profissional', icon: 'plus', label: 'Convidar profissional' },
    { type: 'label', label: 'Financeiro' },
    { to: 'admin/caixa', icon: 'receipt', label: 'Caixa', children: [
      { to: 'admin/caixa', label: 'Comandas' },
      { to: 'admin/caixa?tab=produtos', label: 'Produtos' },
      { to: 'admin/caixa?tab=relatorio', label: 'Relatório' },
    ]},
    { to: 'admin/comissoes', icon: 'chart', label: 'Comissões' },
    { to: 'admin/mensalistas', icon: 'cash', label: 'Mensalistas' },
    { to: 'admin/produtos', icon: 'tag', label: 'Produtos' },
    { to: 'admin/pedidos-produtos', icon: 'cash', label: 'Pedidos de Produtos' },
    { type: 'label', label: 'Conta' },
    { to: 'admin/meus-servicos', icon: 'scissors', label: 'Meus serviços' },
    { to: 'admin/meus-horarios', icon: 'clock', label: 'Meus horários' },
    { to: 'perfil', icon: 'users', label: 'Meu perfil' },
    { to: 'admin/configuracoes', icon: 'settings', label: 'Configurações' },
  ],
  Profissional: [
    { to: 'profissional', end: true, icon: 'cal', label: 'Agenda' },
    { to: 'profissional/agendamentos', icon: 'receipt', label: 'Agendamentos' },
    { to: 'profissional/comandas', icon: 'tag', label: 'Comandas' },
    { type: 'label', label: 'Produtos' },
    { to: 'profissional/produtos', icon: 'package', label: 'Produtos' },
    { to: 'profissional/pedidos-produtos', icon: 'cash', label: 'Pedidos de Produtos' },
    { type: 'label', label: 'Conta' },
    { to: 'profissional/comissoes', icon: 'chart', label: 'Minhas comissões' },
    { to: 'profissional/servicos', icon: 'scissors', label: 'Meus serviços' },
    { to: 'profissional/horarios', icon: 'clock', label: 'Meus horários' },
    { to: 'perfil', icon: 'users', label: 'Meu perfil' },
    { type: 'label', label: 'Como cliente' },
    { to: 'cliente', icon: 'cal', label: 'Meus atendimentos' },
  ],
  Usuario: [
    { to: 'cliente', end: true, icon: 'cal', label: 'Início' },
    { to: 'cliente/agendamentos', icon: 'receipt', label: 'Meus agendamentos' },
    { to: 'cliente/combos', icon: 'package', label: 'Meus combos' },
    { to: 'cliente/comandas', icon: 'cash', label: 'Minhas comandas' },
    { to: 'perfil', icon: 'users', label: 'Perfil e senha' },
  ],
}

// Conta de serviço (notebook do salão): usa as telas do Admin, só Agenda/Caixa/Clientes/Serviços.
navItemsByRole.Servico = [
  { type: 'label', label: 'Operação' },
  { to: 'admin', end: true, icon: 'cal', label: 'Agenda' },
  { to: 'admin/agendamentos', icon: 'receipt', label: 'Agendamentos' },
  { to: 'admin/usuarios', icon: 'users', label: 'Clientes' },
  { to: 'admin/servicos', icon: 'scissors', label: 'Serviços', children: [
    { to: 'admin/servicos', label: 'Serviços' },
    { to: 'admin/servicos?tab=categorias', label: 'Categorias' },
  ]},
  { type: 'label', label: 'Financeiro' },
  { to: 'admin/caixa', icon: 'receipt', label: 'Caixa', children: [
    { to: 'admin/caixa', label: 'Comandas' },
    { to: 'admin/caixa?tab=produtos', label: 'Produtos' },
  ]},
]

// Profissional e conta de Serviço podem ter módulos bloqueados: o item recebe o módulo e o Sidebar esconde o
// que a pessoa não pode ver (Admin sempre vê tudo — usePermission).
for (const role of ['Profissional', 'Admin', 'Servico']) {
  navItemsByRole[role] = navItemsByRole[role].map((item) =>
    item.to && NAV_ITEM_MODULE[item.to] ? { ...item, module: NAV_ITEM_MODULE[item.to] } : item
  )
}
