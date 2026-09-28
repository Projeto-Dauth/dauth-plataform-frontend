import { useEffect, useState } from 'react'
import { Outlet, useParams, Navigate, useLocation, useNavigate } from 'react-router-dom'
import platformApi from '@/lib/platformApi'
import { canEnterSalon } from '@/lib/salonAccess'
import api from '@/lib/api'
import useSalonStore from '@/store/salonStore'
import useAuthStore from '@/store/authStore'

const PALETTES = {
  terracota: {
    bg: '253 244 245', surface: '255 255 255', surface2: '250 240 241', surface3: '244 228 230',
    ink: '42 30 24',   ink2: '91 70 60',       ink3: '141 123 111',     ink4: '180 165 152',
    line: '236 213 216', line2: '243 228 230', line3: '223 196 200',
    brand: '139 74 43', brandDark: '114 57 31', soft: '241 227 214', softInk: '122 63 35',
  },
  sage: {
    bg: '244 248 241', surface: '255 255 255', surface2: '238 245 234', surface3: '224 237 218',
    ink: '24 38 20',   ink2: '58 84 50',       ink3: '98 130 88',       ink4: '152 178 142',
    line: '208 228 200', line2: '226 240 220', line3: '192 218 182',
    brand: '74 107 62', brandDark: '56 84 46', soft: '224 237 218', softInk: '58 84 50',
  },
  ocean: {
    bg: '241 246 252', surface: '255 255 255', surface2: '234 242 250', surface3: '218 232 246',
    ink: '18 32 52',   ink2: '48 72 106',      ink3: '88 118 154',      ink4: '144 170 198',
    line: '200 220 242', line2: '220 234 248', line3: '178 208 234',
    brand: '43 74 107', brandDark: '30 56 86', soft: '214 228 244', softInk: '35 62 92',
  },
  midnight: {
    bg: '19 19 31',    surface: '30 30 46',    surface2: '37 37 56',    surface3: '48 48 72',
    ink: '232 228 244', ink2: '184 180 208',   ink3: '128 124 152',     ink4: '84 80 108',
    line: '48 48 72',  line2: '37 37 56',      line3: '60 60 88',
    brand: '155 143 201', brandDark: '126 114 172', soft: '48 44 72', softInk: '200 194 230',
  },
}

const ALL_VARS = ['bg','surface','surface2','surface3','ink','ink2','ink3','ink4','line','line2','line3','brand','brandDark','soft','softInk']
const VAR_MAP = { surface2: 'surface-2', surface3: 'surface-3', ink2: 'ink-2', ink3: 'ink-3', ink4: 'ink-4', line2: 'line-2', line3: 'line-3', brandDark: 'brand-dark', soft: 'brand-soft', softInk: 'brand-soft-ink' }

function applyPalette(id) {
  const p = PALETTES[id] ?? PALETTES.terracota
  const root = document.documentElement
  ALL_VARS.forEach(k => root.style.setProperty(`--${VAR_MAP[k] ?? k}`, p[k]))
  root.setAttribute('data-palette', id)
}

function resetPalette() {
  const root = document.documentElement
  ALL_VARS.forEach(k => root.style.removeProperty(`--${VAR_MAP[k] ?? k}`))
  root.removeAttribute('data-palette')
}

const PUBLIC_ROUTES = ['agendar', 'portal']

export default function SalonLayout() {
  const { salonSlug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { salon, setSalon } = useSalonStore()
  const { isAuthenticated, updateUser } = useAuthStore()
  const [loading, setLoading] = useState(salon?.slug !== salonSlug)
  const [notFound, setNotFound] = useState(false)

  const currentRoute = location.pathname.split('/').pop()
  const isPublicRoute = PUBLIC_ROUTES.includes(currentRoute)

  // Aplica paleta sempre que o salão mudar (inclui o caso em que já estava carregado)
  useEffect(() => {
    if (salon?.colorPalette) applyPalette(salon.colorPalette)
    return () => resetPalette()
  }, [salon?.colorPalette])

  // O store persiste no localStorage: se o plano/status mudou (upgrade, trial expirado) enquanto o
  // slug continua o mesmo, o effect abaixo sai cedo e o gating de features usaria dado velho.
  useEffect(() => {
    if (!isAuthenticated || isPublicRoute || salon?.slug !== salonSlug) return
    platformApi.get('/salon/my').then(({ data }) => {
      const membership = (Array.isArray(data) ? data : []).find(m => m.salon?.slug === salonSlug)
      const fresh = membership?.salon
      const { salon: cur, role, memberId } = useSalonStore.getState()
      if (membership && !canEnterSalon(membership)) {
        useSalonStore.getState().clearSalon()
        navigate(useAuthStore.getState().user?.platformRole === 'SalonOwner' ? '/meus-saloes' : '/meus-empregos', { replace: true })
        return
      }
      if (!fresh || !cur || (cur.plan === fresh.plan && cur.status === fresh.status)) return
      setSalon({ ...cur, plan: fresh.plan, status: fresh.status }, role, memberId)
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonSlug])

  useEffect(() => {
    if (salon?.slug === salonSlug) return

    setLoading(true)
    setNotFound(false)

    if (isAuthenticated) {
      platformApi.get('/salon/my')
        .then(async ({ data }) => {
          const match = (Array.isArray(data) ? data : []).find(m => m.salon?.slug === salonSlug && canEnterSalon(m))
          if (match) {
            setSalon(
              { id: match.salonId, name: match.salon.name, slug: match.salon.slug, plan: match.salon.plan, status: match.salon.status, colorPalette: match.salon.colorPalette ?? null },
              match.role,
              match.id
            )
            try {
              const { data: perfil } = await api.get('/users/perfil/me', {
                headers: { 'x-salon-id': match.salonId },
              })
              let permissions = null
              if ((perfil.Role === 'Profissional' || perfil.Role === 'Admin')) {
                permissions = await api.get(`/professional/${perfil.UUID}/permissions`, {
                  headers: { 'x-salon-id': match.salonId },
                }).then(r => r.data.data).catch(() => null)
              }
              updateUser({
                id: perfil.UUID,
                publicId: perfil.UUID,
                role: perfil.Role,
                must_change_password: perfil.Must_change_password,
                permissions,
              })
            } catch {}
            return
          }
          // Membro não encontrado — tenta via API pública se for rota pública
          if (isPublicRoute) {
            return platformApi.get(`/platform/salons/${salonSlug}`)
              .then(({ data: s }) => setSalon({ id: s.id, name: s.name, slug: s.slug, plan: s.plan, colorPalette: s.colorPalette ?? null }, null, null))
              .catch(() => setNotFound(true))
          }
          setNotFound(true)
        })
        .catch(() => {
          if (isPublicRoute) {
            platformApi.get(`/platform/salons/${salonSlug}`)
              .then(({ data: s }) => setSalon({ id: s.id, name: s.name, slug: s.slug, plan: s.plan, colorPalette: s.colorPalette ?? null }, null, null))
              .catch(() => setNotFound(true))
          } else {
            setNotFound(true)
          }
        })
        .finally(() => setLoading(false))
    } else if (isPublicRoute) {
      platformApi.get(`/platform/salons/${salonSlug}`)
        .then(({ data: s }) => setSalon({ id: s.id, name: s.name, slug: s.slug, plan: s.plan, colorPalette: s.colorPalette ?? null }, null, null))
        .catch(() => setNotFound(true))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [salonSlug])

  if (!isAuthenticated && !isPublicRoute) return <Navigate to="/login" replace />
  if (notFound) return <Navigate to={isPublicRoute ? '/marketplace' : '/meus-saloes'} replace />
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif', color: 'rgba(42,30,24,.4)', fontSize: 14 }}>
      Carregando salão…
    </div>
  )

  return <Outlet />
}
