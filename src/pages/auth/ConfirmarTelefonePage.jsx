import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import platformApi from '@/lib/platformApi'
import useAuthStore from '@/store/authStore'

// Link recebido no WhatsApp ao trocar o telefone em Minha conta (POST /platform/me/phone).
export default function ConfirmarTelefonePage() {
  const [searchParams] = useSearchParams()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('')
  const [phone, setPhone] = useState('')
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const token = searchParams.get('token')
    if (!token) {
      setErrorMsg('Link inválido.')
      setStatus('error')
      return
    }

    platformApi.post('/auth/confirm-phone-change', { token })
      .then(({ data }) => { setPhone(data.phone); setStatus('success') })
      .catch((err) => {
        setErrorMsg(err.response?.data?.error ?? 'Link inválido ou expirado.')
        setStatus('error')
      })
  }, [])

  const next = isAuthenticated
    ? { to: '/minha-conta', label: 'Ir para Minha conta' }
    : { to: '/login', label: 'Ir para o login' }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

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
              <h3 className="font-display font-medium text-[20px] tracking-tight mb-2">Confirmando seu novo telefone</h3>
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
              <h3 className="font-display font-medium text-[20px] tracking-tight mb-2">Telefone alterado!</h3>
              <p className="text-[13px] text-ink-3 mb-6">
                A partir de agora, entre com <strong className="text-ink-2">{phone}</strong> em todos os salões.
              </p>
              <Link
                to={next.to}
                className="inline-flex items-center justify-center h-[42px] px-6 rounded-md bg-brand text-white font-medium text-[14px] hover:bg-brand/90 transition-colors w-full"
              >
                {next.label}
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
              <h3 className="font-display font-medium text-[20px] tracking-tight mb-2">Não foi possível confirmar</h3>
              <p className="text-[13px] text-ink-3 mb-6">{errorMsg}</p>
              <Link
                to={next.to}
                className="inline-flex items-center justify-center h-[42px] px-6 rounded-md bg-brand text-white font-medium text-[14px] hover:bg-brand/90 transition-colors w-full"
              >
                {next.label}
              </Link>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
