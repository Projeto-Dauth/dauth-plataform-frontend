import { Navigate, useLocation } from 'react-router-dom'
import useAuthStore from '@/store/authStore'
import useSalonStore from '@/store/salonStore'
import { usePermission } from '@/hooks/usePermission'

export default function ProtectedRoute({ children, allowedRoles, platformRoles, requiredModule }) {
  const { isAuthenticated, user } = useAuthStore()
  const { salon, role } = useSalonStore()
  const { can } = usePermission()
  const location = useLocation()

  if (!isAuthenticated) return <Navigate to="/login" replace />

  // Guarda de platformRole (páginas de plataforma)
  if (platformRoles) {
    if (!user?.platformRole || !platformRoles.includes(user.platformRole)) {
      return <Navigate to="/nao-autorizado" replace />
    }
    return children
  }

  // Guarda de role do Produto (precisa de salão selecionado)
  if (!salon) return <Navigate to="/meus-saloes" replace />

  if (user?.must_change_password && !location.pathname.endsWith('/trocar-senha')) {
    const slug = salon?.slug
    return <Navigate to={slug ? `/${slug}/trocar-senha` : '/login'} replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/nao-autorizado" replace />

  if (requiredModule && !can(requiredModule, 'view')) return <Navigate to="/nao-autorizado" replace />

  return children
}
