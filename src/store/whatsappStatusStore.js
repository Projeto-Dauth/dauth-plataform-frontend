import { create } from 'zustand'
import api from '@/lib/api'

const useWhatsappStatusStore = create((set) => ({
  status: null, // 'connected' | 'connecting' | 'disconnected' | null (ainda não checado)

  setStatus: (status) => set({ status }),

  fetchStatus: async () => {
    try {
      const { data } = await api.get('/whatsapp-link/status')
      set({ status: data.status })
    } catch {
      set({ status: 'disconnected' })
    }
  },
}))

export default useWhatsappStatusStore
