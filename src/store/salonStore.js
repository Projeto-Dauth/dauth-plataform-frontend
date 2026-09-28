import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Persiste o salão selecionado no localStorage para não pedir toda vez
const useSalonStore = create(
  persist(
    (set) => ({
      salon: null,  // { id, name, slug, plan }
      role: null,   // 'Admin' | 'Profissional' | 'Usuario'
      memberId: null,

      setSalon: (salon, role, memberId) => set({ salon, role, memberId }),
      clearSalon: () => set({ salon: null, role: null, memberId: null }),
    }),
    { name: 'dauth-salon' }
  )
)

export default useSalonStore
