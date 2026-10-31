import { create } from 'zustand'
import api from '@/lib/api'
import useSalonStore from '@/store/salonStore'

// O layout é montado em cada página: sem este intervalo mínimo, cada troca de página repetiria a busca
// (e o servidor consulta a Evolution a cada uma).
const MIN_INTERVAL_MS = 60_000
let lastFetch = { key: null, at: 0 }

const useWhatsappStatusStore = create((set) => ({
  status: null, // 'connected' | 'connecting' | 'disconnected' | null (ainda não checado)

  setStatus: (status) => set({ status }),

  fetchStatus: async (force = false) => {
    const key = useSalonStore.getState().salon?.id ?? null
    if (!force && lastFetch.key === key && Date.now() - lastFetch.at < MIN_INTERVAL_MS) return
    lastFetch = { key, at: Date.now() }
    try {
      const { data } = await api.get('/whatsapp-link/status')
      set({ status: data.status })
    } catch {
      set({ status: 'disconnected' })
    }
  },
}))

export default useWhatsappStatusStore
