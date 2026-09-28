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

const ALL = ['Admin', 'Profissional', 'Usuario']

const router = createBrowserRouter([
  // ── Auth ──────────────────────────────────────────────────────
  { path: '/login',                   element: <LoginPage /> },
  { path: '/register',                element: <RegisterPage /> },
  { path: '/criar-salao',             element: <CreateSalonPage /> },
  { path: '/auth/accept-invite',      element: <AcceptInvitePage /> },
  { path: '/auth/accept-invite/*',    element: <AcceptInvitePage /> },
  { path: '/verify',                  element: <VerificarContaPage /> },
  { path: '/verificar-email',         element: <VerificarEmailPage /> },
  { path: '/verificar-telefone',      element: <VerificarTelefonePage /> },
  { path: '/esqueci-senha',           element: <EsqueciSenhaPage /> },
  { path: '/redefinir-senha',         element: <RedefinirSenhaPage /> },

  { path: '/selecionar-salao',        element: <Navigate to="/meus-saloes" replace /> },

  // ── Plataforma ─────────────────────────────────────────────────
  {
    path: '/marketplace',
    element: <ProtectedRoute platformRoles={['Cliente', 'SalonOwner']}><MarketplacePage /></ProtectedRoute>,
  },
  {
    path: '/minha-conta',
    element: <ProtectedRoute platformRoles={['Cliente', 'SalonOwner']}><MinhaContaPage /></ProtectedRoute>,
  },
  {
    path: '/meus-saloes',
    element: <ProtectedRoute platformRoles={['SalonOwner']}><MeusSaloesPage /></ProtectedRoute>,
  },
  {
    path: '/meus-empregos',
    element: <ProtectedRoute platformRoles={['Cliente']}><MeusEmpregosPage /></ProtectedRoute>,
  },

  // ── Público ────────────────────────────────────────────────────
  { path: '/salao/:slug',   element: <SalaoPublicPage /> },
  { path: '/privacidade',   element: <PrivacidadePage /> },
  { path: '/termos',        element: <TermosPage /> },

  // ── Produto: rotas com slug do salão ──────────────────────────
  {
    path: '/:salonSlug',
    element: <SalonLayout />,
    children: [
      // Shared
      { path: 'perfil',              element: <ProtectedRoute allowedRoles={ALL}><MeuPerfil /></ProtectedRoute> },
      { path: 'trocar-senha',        element: <ProtectedRoute allowedRoles={ALL}><TrocarSenha /></ProtectedRoute> },
      { path: 'agendamento/:id',     element: <ProtectedRoute allowedRoles={ALL}><DetalhesAgendamento /></ProtectedRoute> },
      { path: 'agendar',             element: <AgendarPage /> },
      { path: 'portal',              element: <PortalPage /> },

      // Admin
      { path: 'admin',                         element: <ProtectedRoute allowedRoles={['Admin']}><AdminAgenda /></ProtectedRoute> },
      { path: 'admin/dashboard',               element: <ProtectedRoute allowedRoles={['Admin']} requiredModule={NAV_ITEM_MODULE['admin/dashboard']}><AdminDashboard /></ProtectedRoute> },
      { path: 'admin/agendamentos',            element: <ProtectedRoute allowedRoles={['Admin']}><AdminAgendamentos /></ProtectedRoute> },
      { path: 'admin/caixa',                   element: <ProtectedRoute allowedRoles={['Admin']} requiredModule={NAV_ITEM_MODULE['admin/caixa']}><AdminCaixa /></ProtectedRoute> },
      { path: 'admin/comissoes',               element: <ProtectedRoute allowedRoles={['Admin']} requiredModule={NAV_ITEM_MODULE['admin/comissoes']}><AdminComissoes /></ProtectedRoute> },
      { path: 'admin/mensalistas',             element: <ProtectedRoute allowedRoles={['Admin']} requiredModule={NAV_ITEM_MODULE['admin/mensalistas']}><AdminMensalistas /></ProtectedRoute> },
      { path: 'admin/configuracoes',           element: <ProtectedRoute allowedRoles={['Admin']}><AdminConfiguracoes /></ProtectedRoute> },
      { path: 'admin/combos',                  element: <ProtectedRoute allowedRoles={['Admin']}><AdminCombos /></ProtectedRoute> },
      { path: 'admin/usuarios',                element: <ProtectedRoute allowedRoles={['Admin']}><AdminUsuarios /></ProtectedRoute> },
      { path: 'admin/servicos',                element: <ProtectedRoute allowedRoles={['Admin']}><AdminServicos /></ProtectedRoute> },
      { path: 'admin/produtos',                element: <ProtectedRoute allowedRoles={['Admin']}><AdminProdutos /></ProtectedRoute> },
      { path: 'admin/pedidos-produtos',        element: <ProtectedRoute allowedRoles={['Admin']}><AdminPedidosProdutos /></ProtectedRoute> },
      { path: 'admin/convidar-profissional',   element: <ProtectedRoute allowedRoles={['Admin']}><ConvidarProfissional /></ProtectedRoute> },
      { path: 'admin/meus-horarios',           element: <ProtectedRoute allowedRoles={['Admin']}><ProfissionalHorarios /></ProtectedRoute> },
      { path: 'admin/meus-servicos',           element: <ProtectedRoute allowedRoles={['Admin']}><ProfissionalServicos /></ProtectedRoute> },

      // Profissional
      { path: 'profissional',                  element: <ProtectedRoute allowedRoles={['Profissional', 'Admin']} requiredModule={NAV_ITEM_MODULE['profissional']}><ProfissionalAgenda /></ProtectedRoute> },
      { path: 'profissional/agendamentos',     element: <ProtectedRoute allowedRoles={['Profissional', 'Admin']} requiredModule={NAV_ITEM_MODULE['profissional/agendamentos']}><MinhaAgenda /></ProtectedRoute> },
      { path: 'profissional/horarios',         element: <ProtectedRoute allowedRoles={['Profissional', 'Admin']} requiredModule={NAV_ITEM_MODULE['profissional/horarios']}><ProfissionalHorarios /></ProtectedRoute> },
      { path: 'profissional/servicos',         element: <ProtectedRoute allowedRoles={['Profissional', 'Admin']}><ProfissionalServicos /></ProtectedRoute> },
      { path: 'profissional/comissoes',        element: <ProtectedRoute allowedRoles={['Profissional', 'Admin']} requiredModule={NAV_ITEM_MODULE['profissional/comissoes']}><ProfissionalComissoes /></ProtectedRoute> },
      { path: 'profissional/comandas',         element: <ProtectedRoute allowedRoles={['Profissional', 'Admin']} requiredModule={NAV_ITEM_MODULE['profissional/comandas']}><ProfissionalComandas /></ProtectedRoute> },
      { path: 'profissional/produtos',         element: <ProtectedRoute allowedRoles={['Profissional', 'Admin']} requiredModule={NAV_ITEM_MODULE['profissional/produtos']}><ProfissionalProdutos /></ProtectedRoute> },
      { path: 'profissional/pedidos-produtos', element: <ProtectedRoute allowedRoles={['Profissional', 'Admin']} requiredModule={NAV_ITEM_MODULE['profissional/pedidos-produtos']}><ProfissionalPedidosProdutos /></ProtectedRoute> },

      // Cliente
      { path: 'cliente',              element: <ProtectedRoute allowedRoles={ALL}><ClienteDashboard /></ProtectedRoute> },
      { path: 'cliente/agendamentos', element: <ProtectedRoute allowedRoles={ALL}><MeusAgendamentos /></ProtectedRoute> },
      { path: 'cliente/combos',       element: <ProtectedRoute allowedRoles={ALL}><MeusCombos /></ProtectedRoute> },
      { path: 'cliente/comandas',     element: <ProtectedRoute allowedRoles={ALL}><MinhasComandas /></ProtectedRoute> },
    ],
  },

  // ── Raiz e erros ───────────────────────────────────────────────
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/nao-autorizado', element: <NaoAutorizado /> },
  { path: '*', element: <NotFound /> },
])

export default router
