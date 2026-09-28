import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create(
  persist(
    (set) => ({
      user: null, // { id, email, name, platformRole, role, publicId, must_change_password }
      isAuthenticated: false,

      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false }),
      restoreSession: (user) => set({ user, isAuthenticated: true }),
      setPlatformRole: (platformRole) => set((s) => ({ user: s.user ? { ...s.user, platformRole } : s.user })),
      clearMustChangePassword: () => set((s) => ({ user: s.user ? { ...s.user, must_change_password: false } : null })),
      updateUser: (fields) => set((s) => ({ user: s.user ? { ...s.user, ...fields } : s.user })),
    }),
    { name: 'dauth-auth' }
  )
)

export default useAuthStore
