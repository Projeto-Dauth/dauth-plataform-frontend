import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import logo from '@/logo-dauth-agendamentos.png'

export default function VerificarContaPage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('')
  const called = useRef(false)

  const next = searchParams.get('next')
  const loginHref = next ? `/login?redirect=${encodeURIComponent(next)}` : '/login'
  const hasBooking = Boolean(next)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const token = searchParams.get('token')

    if (!token) {
      setErrorMsg('Link inválido. Solicite um novo cadastro.')
      setStatus('error')
      return
    }

    api.post('/auth/verify', { token })
      .then(() => setStatus('success'))
      .catch((err) => {
        setErrorMsg(err.response?.data?.error ?? 'Token inválido ou expirado.')
        setStatus('error')
      })
  }, [])

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Dauth" className="w-14 h-14 rounded-xl object-cover mb-4" />
          <h1 className="font-display font-medium text-[28px] tracking-tight">Dauth Agendamentos</h1>
          <p className="text-ink-3 text-[13px] mt-1">Salão da Candi</p>
        </div>

        <div className="bg-surface border border-line rounded-[14px] p-8 text-center">

          {status === 'loading' && (
            <>
              <div className="w-10 h-10 rounded-full border-2 border-line border-t-brand animate-spin mx-auto mb-5" />
              <h3 className="font-display font-medium text-[20px] tracking-tight mb-2">
                Verificando sua conta
              </h3>
              <p className="text-[13px] text-ink-3">Aguarde um momento…</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-5">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4a6b3e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className="font-display font-medium text-[20px] tracking-tight mb-2">
                Conta verificada!
              </h3>
              <p className="text-[13px] text-ink-3 mb-6">
                {hasBooking
                  ? 'Sua conta está ativa. Entre para continuar seu agendamento.'
                  : 'Sua conta está ativa. Agora é só entrar.'}
              </p>
              <Link
                to={loginHref}
                className="inline-flex items-center justify-center h-[42px] px-6 rounded-md bg-brand text-white font-medium text-[14px] hover:bg-brand/90 transition-colors w-full"
              >
                {hasBooking ? 'Entrar e continuar agendamento' : 'Ir para o login'}
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-5">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8b3a32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h3 className="font-display font-medium text-[20px] tracking-tight mb-2">
                Não foi possível confirmar o link
              </h3>
              <p className="text-[13px] text-ink-3 mb-2">{errorMsg}</p>
              <p className="text-[13px] text-ink-3 mb-6">
                Se você já clicou neste link antes (ou abriu em outro app), sua conta pode
                já estar ativa. Tente entrar com seu telefone e senha antes de criar uma
                conta nova.
              </p>
              <Link
                to={loginHref}
                className="inline-flex items-center justify-center h-[42px] px-6 rounded-md bg-brand text-white font-medium text-[14px] hover:bg-brand/90 transition-colors w-full"
              >
                Tentar entrar
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center h-[42px] px-6 mt-2 rounded-md border border-line text-ink-2 font-medium text-[14px] hover:border-ink-3 transition-colors w-full"
              >
                Criar nova conta
              </Link>
            </>
          )}

        </div>

        {status !== 'loading' && (
          <div className="text-center mt-5">
            <Link to={loginHref} className="text-[13px] text-ink-3 hover:text-ink transition-colors">
              Já tenho conta — entrar
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
