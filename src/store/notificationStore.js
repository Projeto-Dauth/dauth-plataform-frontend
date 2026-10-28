import { create } from 'zustand'
import api from '@/lib/api'
import useSalonStore from '@/store/salonStore'

// O layout é montado em cada página: sem este intervalo mínimo, cada troca de página repetiria a busca.
const MIN_INTERVAL_MS = 60_000
let lastFetch = { key: null, at: 0 }

const useNotificationStore = create((set, get) => ({
  unreadCount: 0,
  notifications: [],
  drawerOpen: false,

  fetchUnreadCount: async (force = false) => {
    const key = useSalonStore.getState().salon?.id ?? null
    if (!force && lastFetch.key === key && Date.now() - lastFetch.at < MIN_INTERVAL_MS) return
    lastFetch = { key, at: Date.now() }
    try {
      const { data } = await api.get('/notification/unread-count')
      set({ unreadCount: data.count })
    } catch {}
  },

  fetchNotifications: async () => {
    try {
      const { data } = await api.get('/notification?limit=30')
      set({ notifications: data.data })
    } catch {}
  },

  openDrawer: async () => {
    set({ drawerOpen: true })
    await get().fetchNotifications()
  },

  closeDrawer: () => set({ drawerOpen: false }),

  markRead: async (uuid) => {
    try {
      await api.patch(`/notification/${uuid}/read`)
      set((s) => ({
        notifications: s.notifications.map((n) =>
          n.UUID === uuid ? { ...n, read_at: new Date().toISOString() } : n
        ),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }))
    } catch {}
  },

  markAllRead: async () => {
    try {
      await api.patch('/notification/read-all')
      const now = new Date().toISOString()
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, read_at: n.read_at ?? now })),
        unreadCount: 0,
      }))
    } catch {}
  },
}))

export default useNotificationStore
