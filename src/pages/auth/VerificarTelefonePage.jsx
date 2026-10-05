import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import platformApi from '@/lib/platformApi'

export default function VerificarTelefonePage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('')
  const [joinedSalons, setJoinedSalons] = useState([]) // conta criada pelo convite: equipes em que entrou
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const token = searchParams.get('token')

    if (!token) {
      setErrorMsg('Link inválido. Solicite um novo cadastro.')
      setStatus('error')
      return
    }

    platformApi.post('/auth/verify-phone', { token })
      .then(({ data }) => { setJoinedSalons(data.joinedSalons ?? []); setStatus('success') })
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
          <div className="w-14 h-14 rounded-xl bg-brand flex items-center justify-center mb-4">
            <span className="font-serif text-white text-2xl">D</span>
          </div>
          <h1 className="font-display font-medium text-[28px] tracking-tight">Dauth</h1>
        </div>

        <div className="bg-surface border border-line rounded-[14px] p-8 text-center">

          {status === 'loading' && (
            <>
              <div className="w-10 h-10 rounded-full border-2 border-line border-t-brand animate-spin mx-auto mb-5" />
              <h3 className="font-display font-medium text-[20px] tracking-tight mb-2">
                Confirmando seu telefone
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
                Telefone confirmado!
              </h3>
              <p className="text-[13px] text-ink-3 mb-6">
                Sua conta está ativa.{joinedSalons.length > 0 && <> Você já faz parte da equipe de <strong className="text-ink-2">{joinedSalons.join(', ')}</strong>.</>} Agora é só entrar.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center h-[42px] px-6 rounded-md bg-brand text-white font-medium text-[14px] hover:bg-brand/90 transition-colors w-full"
              >
                Ir para o login
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
                Se você já clicou neste link antes, sua conta pode já estar ativa. Tente entrar normalmente.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center h-[42px] px-6 rounded-md bg-brand text-white font-medium text-[14px] hover:bg-brand/90 transition-colors w-full"
              >
                Tentar entrar
              </Link>
            </>
          )}

        </div>

        {status !== 'loading' && (
          <div className="text-center mt-5">
            <Link to="/register" className="text-[13px] text-ink-3 hover:text-ink transition-colors">
              Criar nova conta
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
