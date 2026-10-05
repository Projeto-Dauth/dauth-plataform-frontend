import axios from 'axios'
import useAuthStore from '@/store/authStore'

// API da plataforma (porta 3000) — marketplace, salões, auth Better Auth
const platformApi = axios.create({
  baseURL: import.meta.env.VITE_PLATFORM_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

platformApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const isAuthEndpoint = original.url?.includes('/auth/')
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true
      const isAuthenticated = useAuthStore.getState().isAuthenticated
      if (!isAuthenticated) return Promise.reject(error)
      try {
        return await platformApi(original)
      } catch {
        useAuthStore.getState().logout()
        // Volta para a página atual depois do login (ex: link de convite com sessão vencida)
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

export default platformApi
