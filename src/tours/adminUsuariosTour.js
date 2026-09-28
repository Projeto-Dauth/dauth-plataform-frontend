export const adminUsuariosSteps = [
  {
    id: 'lista',
    title: 'Clientes, profissionais e admins',
    text: 'Esta tela reúne todos os usuários do sistema. Use o filtro de role para separar Clientes, Profissionais e Administradores.',
    attachTo: { element: '[data-tour="usuarios-filtro"]', on: 'bottom' },
  },
  {
    id: 'cadastrar',
    title: 'Cadastrar novo usuário',
    text: 'Clique em "Novo usuário" para cadastrar um cliente ou profissional diretamente pelo Admin. A senha padrão é 12345678.',
    attachTo: { element: '[data-tour="usuarios-novo"]', on: 'left' },
  },
  {
    id: 'senha-padrao',
    title: 'Troca de senha obrigatória',
    text: 'Na primeira vez que o usuário fizer login com a senha padrão, o sistema vai pedir para ele criar uma senha própria antes de acessar qualquer tela.',
    attachTo: { element: '[data-tour="usuarios-lista"]', on: 'top' },
  },
  {
    id: 'ativar-desativar',
    title: 'Ativar ou desativar',
    text: 'Pelo botão de status você pode desativar um usuário sem excluí-lo — ele não consegue mais fazer login, mas o histórico de atendimentos é preservado.',
    attachTo: { element: '[data-tour="usuarios-lista"]', on: 'top' },
    buttons: [
      { text: 'Entendido!', action() { this.complete() }, classes: 'shepherd-btn-primary' },
    ],
  },
]
