import { useNavigate, Link } from 'react-router-dom'
import useAuthStore from '@/store/authStore'
import useSalonStore from '@/store/salonStore'

const ROLE_DEST = {
  Admin: (slug) => `/${slug}/admin`,
  Profissional: (slug) => `/${slug}/profissional`,
  Usuario: (slug) => `/${slug}/cliente`,
}

export default function NaoAutorizado() {
  const { user, isAuthenticated } = useAuthStore()
  const { salon, role } = useSalonStore()
  const navigate = useNavigate()

  const isProfissional = role === 'Profissional'

  function handleHome() {
    if (!isAuthenticated) return navigate('/login', { replace: true })
    const dest = role && salon?.slug ? ROLE_DEST[role]?.(salon.slug) : null
    navigate(dest ?? (user?.platformRole === 'SalonOwner' ? '/meus-saloes' : '/marketplace'), { replace: true })
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-danger-soft flex items-center justify-center mx-auto mb-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-danger">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 className="font-display font-medium text-[24px] tracking-tight text-ink mb-2">
          Acesso restrito
        </h1>

        {isProfissional ? (
          <p className="text-[13.5px] text-ink-3 mb-2 leading-relaxed">
            Você não tem acesso a essa função.
          </p>
        ) : (
          <p className="text-[13.5px] text-ink-3 mb-2 leading-relaxed">
            Você não tem permissão para acessar esta página.
          </p>
        )}

        {isProfissional && (
          <p className="text-[12.5px] text-ink-4 mb-6">
            Se precisar de ajuda, entre em contato com o administrador do salão.
          </p>
        )}

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={handleHome}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand text-white font-medium text-[13.5px] hover:opacity-90 transition-opacity cursor-pointer"
          >
            Voltar ao painel
          </button>
          <Link to="/login" className="text-[12px] text-ink-4 hover:text-ink-2 transition-colors underline underline-offset-2">
            Ir para o login
          </Link>
        </div>
      </div>
    </div>
  )
}
