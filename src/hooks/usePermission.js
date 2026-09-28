import useAuthStore from '@/store/authStore'

export function usePermission() {
  const user = useAuthStore((state) => state.user)

  const can = (module, action = 'view') => {
    if (!module) return true
    if (user?.role !== 'Profissional' && user?.role !== 'Admin') return true

    const perm = user.permissions?.find((p) => p.module === module)
    if (!perm) return true

    return action === 'manage' ? perm.canManage : perm.canView
  }

  return { can }
}
