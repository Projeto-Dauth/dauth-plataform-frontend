import { createBrowserRouter, Navigate } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import SalonLayout from '@/components/layout/SalonLayout'
import { NAV_ITEM_MODULE } from '@/config/modules'

import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import CreateSalonPage from '@/pages/auth/CreateSalonPage'
import AcceptInvitePage from '@/pages/auth/AcceptInvitePage'
import VerificarContaPage from '@/pages/auth/VerificarContaPage'
import VerificarEmailPage from '@/pages/auth/VerificarEmailPage'
import VerificarTelefonePage from '@/pages/auth/VerificarTelefonePage'
import ConfirmarTelefonePage from '@/pages/auth/ConfirmarTelefonePage'
import EsqueciSenhaPage from '@/pages/auth/EsqueciSenhaPage'
import RedefinirSenhaPage from '@/pages/auth/RedefinirSenhaPage'

// Platform
import MarketplacePage from '@/pages/platform/MarketplacePage'
import MeusSaloesPage from '@/pages/platform/MeusSaloesPage'
import MeusEmpregosPage from '@/pages/platform/MeusEmpregosPage'
import SalaoPublicPage from '@/pages/platform/SalaoPublicPage'
import MinhaContaPage from '@/pages/platform/MinhaContaPage'

// Produto — Admin
import AdminDashboard from '@/pages/admin/AdminDashboard'
import AdminAgenda from '@/pages/admin/AdminAgenda'
import AdminAgendamentos from '@/pages/admin/AdminAgendamentos'
import AdminCaixa from '@/pages/admin/AdminCaixa'
import AdminCombos from '@/pages/admin/AdminCombos'
import AdminUsuarios from '@/pages/admin/AdminUsuarios'
import AdminServicos from '@/pages/admin/AdminServicos'
import AdminProdutos from '@/pages/admin/AdminProdutos'
import AdminPedidosProdutos from '@/pages/admin/AdminPedidosProdutos'
import AdminComissoes from '@/pages/admin/AdminComissoes'
import AdminMensalistas from '@/pages/admin/AdminMensalistas'
import AdminConfiguracoes from '@/pages/admin/AdminConfiguracoes'
import ConvidarProfissional from '@/pages/admin/ConvidarProfissional'

// Produto — Profissional
import ProfissionalAgenda from '@/pages/profissional/ProfissionalAgenda'
import MinhaAgenda from '@/pages/profissional/MinhaAgenda'
import ProfissionalHorarios from '@/pages/profissional/ProfissionalHorarios'
import ProfissionalServicos from '@/pages/profissional/ProfissionalServicos'
import ProfissionalComissoes from '@/pages/profissional/ProfissionalComissoes'
import ProfissionalComandas from '@/pages/profissional/ProfissionalComandas'
import ProfissionalProdutos from '@/pages/profissional/ProfissionalProdutos'
import ProfissionalPedidosProdutos from '@/pages/profissional/ProfissionalPedidosProdutos'

// Produto — Cliente
import ClienteDashboard from '@/pages/cliente/ClienteDashboard'
import MeusAgendamentos from '@/pages/cliente/MeusAgendamentos'
import MeusCombos from '@/pages/cliente/MeusCombos'
import MinhasComandas from '@/pages/cliente/MinhasComandas'

// Shared
import MeuPerfil from '@/pages/shared/MeuPerfil'
import TrocarSenha from '@/pages/shared/TrocarSenha'
import DetalhesAgendamento from '@/pages/shared/DetalhesAgendamento'

// Público
import AgendarPage from '@/pages/public/AgendarPage'
import PortalPage from '@/pages/public/PortalPage'
import PrivacidadePage from '@/pages/public/PrivacidadePage'
import TermosPage from '@/pages/public/TermosPage'
import NaoAutorizado from '@/pages/NaoAutorizado'
import NotFound from '@/pages/NotFound'

const ALL = ['Admin', 'Profissional', 'Usuario', 'Servico']
// Telas do Admin que a conta de serviço (notebook do salão) também usa, conforme os módulos dela
const ADMIN_OR_SERVICE = ['Admin', 'Servico']

const router = createBrowserRouter([
  // ── Auth ──────────────────────────────────────────────────────
  { path: '/login',                   handle: { title: 'Entrar' }, element: <LoginPage /> },
  { path: '/register',                handle: { title: 'Criar conta' }, element: <RegisterPage /> },
  { path: '/criar-salao',             handle: { title: 'Criar salão' }, element: <CreateSalonPage /> },
  { path: '/auth/accept-invite',      handle: { title: 'Aceitar convite' }, element: <AcceptInvitePage /> },
  { path: '/auth/accept-invite/*',    handle: { title: 'Aceitar convite' }, element: <AcceptInvitePage /> },
  { path: '/verify',                  handle: { title: 'Verificar conta' }, element: <VerificarContaPage /> },
  { path: '/verificar-email',         handle: { title: 'Confirmar email' }, element: <VerificarEmailPage /> },
  { path: '/verificar-telefone',      handle: { title: 'Confirmar telefone' }, element: <VerificarTelefonePage /> },
  { path: '/confirmar-telefone',      handle: { title: 'Confirmar novo telefone' }, element: <ConfirmarTelefonePage /> },
  { path: '/esqueci-senha',           handle: { title: 'Esqueci minha senha' }, element: <EsqueciSenhaPage /> },
  { path: '/redefinir-senha',         handle: { title: 'Redefinir senha' }, element: <RedefinirSenhaPage /> },

  { path: '/selecionar-salao',        element: <Navigate to="/meus-saloes" replace /> },

  // ── Plataforma ─────────────────────────────────────────────────
  {
    path: '/marketplace',
    handle: { title: 'Marketplace' },
    element: <ProtectedRoute platformRoles={['Cliente', 'SalonOwner']}><MarketplacePage /></ProtectedRoute>,
  },
  {
    path: '/minha-conta',
    handle: { title: 'Minha conta' },
    element: <ProtectedRoute platformRoles={['Cliente', 'SalonOwner']}><MinhaContaPage /></ProtectedRoute>,
  },
  {
    path: '/meus-saloes',
    handle: { title: 'Meus salões' },
    element: <ProtectedRoute platformRoles={['SalonOwner']}><MeusSaloesPage /></ProtectedRoute>,
  },
  {
    path: '/meus-empregos',
    handle: { title: 'Meus empregos' },
    element: <ProtectedRoute platformRoles={['Cliente']}><MeusEmpregosPage /></ProtectedRoute>,
  },

  // ── Público ────────────────────────────────────────────────────
  { path: '/salao/:slug',   handle: { title: 'Salão' }, element: <SalaoPublicPage /> },
  { path: '/privacidade',   handle: { title: 'Privacidade' }, element: <PrivacidadePage /> },
  { path: '/termos',        handle: { title: 'Termos de uso' }, element: <TermosPage /> },

  // ── Produto: rotas com slug do salão ──────────────────────────
  {
    path: '/:salonSlug',
    element: <SalonLayout />,
    children: [
      // Shared
      { path: 'perfil',              handle: { title: 'Perfil' }, element: <ProtectedRoute allowedRoles={ALL}><MeuPerfil /></ProtectedRoute> },
      { path: 'trocar-senha',        handle: { title: 'Trocar senha' }, element: <ProtectedRoute allowedRoles={ALL}><TrocarSenha /></ProtectedRoute> },
      { path: 'agendamento/:id',     handle: { title: 'Agendamento' }, element: <ProtectedRoute allowedRoles={ALL}><DetalhesAgendamento /></ProtectedRoute> },
      { path: 'agendar',             handle: { title: 'Agendar' }, element: <AgendarPage /> },
      { path: 'portal',              handle: { title: 'Portal' }, element: <PortalPage /> },

      // Admin
      { path: 'admin',                         handle: { title: 'Agenda' }, element: <ProtectedRoute allowedRoles={ADMIN_OR_SERVICE} requiredModule={NAV_ITEM_MODULE['admin']}><AdminAgenda /></ProtectedRoute> },
      { path: 'admin/dashboard',               handle: { title: 'Dashboard' }, element: <ProtectedRoute allowedRoles={['Admin']} requiredModule={NAV_ITEM_MODULE['admin/dashboard']}><AdminDashboard /></ProtectedRoute> },
      { path: 'admin/agendamentos',            handle: { title: 'Agendamentos' }, element: <ProtectedRoute allowedRoles={ADMIN_OR_SERVICE} requiredModule={NAV_ITEM_MODULE['admin/agendamentos']}><AdminAgendamentos /></ProtectedRoute> },
      { path: 'admin/caixa',                   handle: { title: 'Caixa' }, element: <ProtectedRoute allowedRoles={ADMIN_OR_SERVICE} requiredModule={NAV_ITEM_MODULE['admin/caixa']}><AdminCaixa /></ProtectedRoute> },
      { path: 'admin/comissoes',               handle: { title: 'Comissões' }, element: <ProtectedRoute allowedRoles={['Admin']} requiredModule={NAV_ITEM_MODULE['admin/comissoes']}><AdminComissoes /></ProtectedRoute> },
      { path: 'admin/mensalistas',             handle: { title: 'Mensalistas' }, element: <ProtectedRoute allowedRoles={['Admin']} requiredModule={NAV_ITEM_MODULE['admin/mensalistas']}><AdminMensalistas /></ProtectedRoute> },
      { path: 'admin/configuracoes',           handle: { title: 'Configurações' }, element: <ProtectedRoute allowedRoles={['Admin']}><AdminConfiguracoes /></ProtectedRoute> },
      { path: 'admin/combos',                  handle: { title: 'Pacotes' }, element: <ProtectedRoute allowedRoles={['Admin']}><AdminCombos /></ProtectedRoute> },
      { path: 'admin/usuarios',                handle: { title: 'Clientes' }, element: <ProtectedRoute allowedRoles={ADMIN_OR_SERVICE} requiredModule={NAV_ITEM_MODULE['admin/usuarios']}><AdminUsuarios /></ProtectedRoute> },
      { path: 'admin/servicos',                handle: { title: 'Serviços' }, element: <ProtectedRoute allowedRoles={ADMIN_OR_SERVICE} requiredModule={NAV_ITEM_MODULE['admin/servicos']}><AdminServicos /></ProtectedRoute> },
      { path: 'admin/produtos',                handle: { title: 'Produtos' }, element: <ProtectedRoute allowedRoles={['Admin']}><AdminProdutos /></ProtectedRoute> },
      { path: 'admin/pedidos-produtos',        handle: { title: 'Pedidos de produtos' }, element: <ProtectedRoute allowedRoles={['Admin']}><AdminPedidosProdutos /></ProtectedRoute> },
      { path: 'admin/convidar-profissional',   handle: { title: 'Profissionais' }, element: <ProtectedRoute allowedRoles={['Admin']}><ConvidarProfissional /></ProtectedRoute> },
      { path: 'admin/meus-horarios',           handle: { title: 'Meus horários' }, element: <ProtectedRoute allowedRoles={['Admin']}><ProfissionalHorarios /></ProtectedRoute> },
      { path: 'admin/meus-servicos',           handle: { title: 'Meus serviços' }, element: <ProtectedRoute allowedRoles={['Admin']}><ProfissionalServicos /></ProtectedRoute> },

      // Profissional
      { path: 'profissional',                  handle: { title: 'Agenda' }, element: <ProtectedRoute allowedRoles={['Profissional', 'Admin']} requiredModule={NAV_ITEM_MODULE['profissional']}><ProfissionalAgenda /></ProtectedRoute> },
      { path: 'profissional/agendamentos',     handle: { title: 'Agendamentos' }, element: <ProtectedRoute allowedRoles={['Profissional', 'Admin']} requiredModule={NAV_ITEM_MODULE['profissional/agendamentos']}><MinhaAgenda /></ProtectedRoute> },
      { path: 'profissional/horarios',         handle: { title: 'Meus horários' }, element: <ProtectedRoute allowedRoles={['Profissional', 'Admin']} requiredModule={NAV_ITEM_MODULE['profissional/horarios']}><ProfissionalHorarios /></ProtectedRoute> },
      { path: 'profissional/servicos',         handle: { title: 'Meus serviços' }, element: <ProtectedRoute allowedRoles={['Profissional', 'Admin']}><ProfissionalServicos /></ProtectedRoute> },
      { path: 'profissional/comissoes',        handle: { title: 'Minhas comissões' }, element: <ProtectedRoute allowedRoles={['Profissional', 'Admin']} requiredModule={NAV_ITEM_MODULE['profissional/comissoes']}><ProfissionalComissoes /></ProtectedRoute> },
      { path: 'profissional/comandas',         handle: { title: 'Comandas' }, element: <ProtectedRoute allowedRoles={['Profissional', 'Admin']} requiredModule={NAV_ITEM_MODULE['profissional/comandas']}><ProfissionalComandas /></ProtectedRoute> },
      { path: 'profissional/produtos',         handle: { title: 'Produtos' }, element: <ProtectedRoute allowedRoles={['Profissional', 'Admin']} requiredModule={NAV_ITEM_MODULE['profissional/produtos']}><ProfissionalProdutos /></ProtectedRoute> },
      { path: 'profissional/pedidos-produtos', handle: { title: 'Pedidos de produtos' }, element: <ProtectedRoute allowedRoles={['Profissional', 'Admin']} requiredModule={NAV_ITEM_MODULE['profissional/pedidos-produtos']}><ProfissionalPedidosProdutos /></ProtectedRoute> },

      // Cliente
      { path: 'cliente',              handle: { title: 'Início' }, element: <ProtectedRoute allowedRoles={ALL}><ClienteDashboard /></ProtectedRoute> },
      { path: 'cliente/agendamentos', handle: { title: 'Meus agendamentos' }, element: <ProtectedRoute allowedRoles={ALL}><MeusAgendamentos /></ProtectedRoute> },
      { path: 'cliente/combos',       handle: { title: 'Meus combos' }, element: <ProtectedRoute allowedRoles={ALL}><MeusCombos /></ProtectedRoute> },
      { path: 'cliente/comandas',     handle: { title: 'Minhas comandas' }, element: <ProtectedRoute allowedRoles={ALL}><MinhasComandas /></ProtectedRoute> },
    ],
  },

  // ── Raiz e erros ───────────────────────────────────────────────
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/nao-autorizado', handle: { title: 'Acesso negado' }, element: <NaoAutorizado /> },
  { path: '*', handle: { title: 'Página não encontrada' }, element: <NotFound /> },
])

// Título da aba: "Dauth | <título da rota>" (handle.title da rota mais específica), ou o nome do sistema.
function applyDocumentTitle({ matches }) {
  const title = [...matches].reverse().find((m) => m.route.handle?.title)?.route.handle.title
  document.title = title ? `Dauth | ${title}` : 'Dauth | Sistema de agendamentos'
}
applyDocumentTitle(router.state)
router.subscribe(applyDocumentTitle)

export default router
