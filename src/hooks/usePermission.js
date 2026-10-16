import useAuthStore from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { SERVICE_ACCOUNT_MODULES } from '@/config/modules'

const SERVICE_KEYS = SERVICE_ACCOUNT_MODULES.map(m => m.key)

export function usePermission() {
  const user = useAuthStore((state) => state.user)
  const role = useRole()

  const can = (module, action = 'view') => {
    if (!module) return true
    // Admin sempre tem acesso total; só Profissional e conta de Serviço têm módulos bloqueáveis.
    if (role !== 'Profissional' && role !== 'Servico') return true
    // Conta de serviço nunca acessa módulo fora dos seus (ex: Comissões, Dashboard)
    if (role === 'Servico' && !SERVICE_KEYS.includes(module)) return false

    const perm = user?.permissions?.find((p) => p.module === module)
    if (!perm) return true

    return action === 'manage' ? perm.canManage : perm.canView
  }

  return { can }
}
