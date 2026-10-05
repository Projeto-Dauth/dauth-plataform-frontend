import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import router from './router/index.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import useAuthStore from './store/authStore.js'
import useSalonStore from './store/salonStore.js'
import { authClient } from './lib/authClient.js'
import api from './lib/api.js'
import CookieBanner from './components/ui/CookieBanner.jsx'

async function bootstrap() {
  try {
    const { data } = await authClient.getSession()
    if (data?.user) {
      const user = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        platformRole: data.user.platformRole ?? 'Cliente',
      }

      // Se há salão selecionado, busca o perfil do membro no produto (role, publicId, tours)
      const salon = useSalonStore.getState().salon
      if (salon?.id) {
        try {
          const { data: perfil } = await api.get('/users/perfil/me')
          // Se o perfil retornado é de outro usuário (sessão stale), limpa o salão
          if (perfil.auth_id && perfil.auth_id !== data.user.id) {
            useSalonStore.getState().clearSalon()
          } else {
            let permissions = null
            if (['Profissional', 'Servico'].includes(perfil.Role)) {
              permissions = await api.get(`/professional/${perfil.UUID}/permissions`).then(r => r.data.data).catch(() => null)
            }
            Object.assign(user, {
              id: perfil.UUID,
              publicId: perfil.UUID,
              role: perfil.Role,
              must_change_password: perfil.Must_change_password,
              permissions,
            })
          }
          const toursCompleted = perfil.Tours_completed ?? {}
          Object.entries(toursCompleted).forEach(([key, done]) => {
            if (done) localStorage.setItem(`dauth_tour_${key}`, 'done')
          })

          // Auto-redirect para dashboard do produto se estiver em / ou /login
          const path = window.location.pathname
          if (path === '/' || path === '/login') {
            const role = useSalonStore.getState().role
            const area = role === 'Admin' ? 'admin' : role === 'Profissional' ? 'profissional' : 'cliente'
            const dest = `/${salon.slug}/${area}` // rotas do produto sempre levam o slug do salão
            useAuthStore.getState().restoreSession(user)
            window.location.replace(dest)
            return
          }
        } catch {
          // sem sessão no produto — continua com dados da plataforma apenas
        }
      }

      useAuthStore.getState().restoreSession(user)
    } else {
      // Sessão inválida ou expirada — limpa tudo para forçar novo login
      useAuthStore.getState().logout()
      useSalonStore.getState().clearSalon()
    }
  } catch {
    useAuthStore.getState().logout()
    useSalonStore.getState().clearSalon()
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ToastProvider>
        <RouterProvider router={router} />
        <CookieBanner />
      </ToastProvider>
    </React.StrictMode>
  )
}

bootstrap()
