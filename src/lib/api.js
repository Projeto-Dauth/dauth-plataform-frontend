import axios from 'axios'
import useAuthStore from '@/store/authStore'
import useSalonStore from '@/store/salonStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// Injeta x-salon-id e x-member-id automaticamente em todo request
api.interceptors.request.use((config) => {
  const { salon, memberId } = useSalonStore.getState()
  if (salon?.id) config.headers['x-salon-id'] = salon.id
  if (memberId) config.headers['x-member-id'] = memberId
  return config
})

// Se receber 401, faz logout e redireciona para /login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const isAuthEndpoint = original.url?.includes('/auth/')

    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true
      const isAuthenticated = useAuthStore.getState().isAuthenticated
      const salon = useSalonStore.getState().salon

      if (!isAuthenticated) return Promise.reject(error)
      if (salon?.id === 'demo-salon') return Promise.reject(error)

      // Better Auth renova sessão automaticamente via cookie — basta retentar
      try {
        return await api(original)
      } catch {
        useAuthStore.getState().logout()
        useSalonStore.getState().clearSalon()
        sessionStorage.setItem('session_expired', '1')
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

export default api
