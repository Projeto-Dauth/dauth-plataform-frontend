import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import Button from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import platformApi from '@/lib/platformApi'
import logo from '@/logo-dauth-agendamentos.png'

export default function AcceptInvitePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [inviteInfo, setInviteInfo] = useState(null) // { existingUser, name }
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [infoError, setInfoError] = useState(null)

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) { setLoadingInfo(false); return }
    platformApi.get(`/salon/invite-info?token=${token}`)
      .then(r => setInviteInfo(r.data))
      .catch(err => setInfoError(err.response?.data?.error ?? 'Link de convite inválido ou expirado.'))
      .finally(() => setLoadingInfo(false))
  }, [token])

  if (!token) {
    return (
      <Layout>
        <ErrorBox message="O link de convite está incompleto. Peça ao administrador que envie um novo convite." />
        <Link to="/login" className="block mt-4 text-[13px] text-ink-3 hover:text-ink transition-colors text-center">
          Ir para o login
        </Link>
      </Layout>
    )
  }

  if (loadingInfo) return <PageSpinner />

  if (infoError) {
    return (
      <Layout>
        <ErrorBox message={infoError} />
        <Link to="/login" className="block mt-4 text-[13px] text-ink-3 hover:text-ink transition-colors text-center">
          Ir para o login
        </Link>
      </Layout>
    )
  }

  if (done) {
    return (
      <Layout>
        <div className="bg-surface border border-line rounded-[14px] p-6 text-center">
          <p className="font-display font-medium text-[18px] mb-2">
            {inviteInfo?.existingUser ? 'Convite aceito!' : 'Conta ativada!'}
          </p>
          <p className="text-[13px] text-ink-2 mb-5">
            {inviteInfo?.existingUser
              ? 'Você agora faz parte do novo salão. Faça login para acessar.'
              : 'Seu cadastro foi concluído. Faça login com seu telefone e a senha que você criou.'}
          </p>
          <Button onClick={() => navigate('/login')} className="w-full justify-center">
            Ir para o login
          </Button>
        </div>
      </Layout>
    )
  }

  function validate() {
    const e = {}
    if (!phone.trim()) e.phone = 'Telefone obrigatório'
    else if (!/^\(\d{2}\) \d \d{4}-\d{4}$/.test(phone)) e.phone = 'Formato: (11) 9 9999-9999'
    if (!password || password.length < 8) e.password = 'Senha deve ter no mínimo 8 caracteres'
    if (password !== confirmPassword) e.confirmPassword = 'As senhas não coincidem'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!inviteInfo?.existingUser && !validate()) return
    setLoading(true)
    try {
      const body = inviteInfo?.existingUser
        ? { token }
        : { token, phone: phone.trim(), password }
      await platformApi.post('/salon/accept-invite', body)
      setDone(true)
    } catch (err) {
      setErrors({ api: err.response?.data?.error ?? 'Erro ao aceitar convite. O link pode ter expirado.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="bg-surface border border-line rounded-[14px] p-5 md:p-8">
        {inviteInfo?.existingUser ? (
          <>
            <p className="text-[15px] text-ink mb-1">
              Olá, <strong>{inviteInfo.name}</strong>!
            </p>
            <p className="text-[13px] text-ink-3 mb-6">
              Você foi convidado para trabalhar em um novo salão. Clique em aceitar para confirmar o vínculo.
            </p>

            {errors.api && <ErrorBox message={errors.api} />}

            <form onSubmit={handleSubmit} noValidate>
              <Button type="submit" loading={loading} className="w-full justify-center mt-2">
                Aceitar convite
              </Button>
            </form>
          </>
        ) : (
          <>
            <p className="text-[13px] text-ink-3 mb-6">
              Escolha seu telefone e senha para acessar o sistema.
            </p>

            {errors.api && <ErrorBox message={errors.api} />}

            <form onSubmit={handleSubmit} noValidate>
              <Field label="Telefone" error={errors.phone}>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(formatPhone(e.target.value))}
                  placeholder="(11) 9 9999-9999"
                  className={inputCls(errors.phone)}
                />
              </Field>

              <Field label="Senha" error={errors.password}>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className={inputCls(errors.password) + ' pr-10'}
                  />
                  <EyeToggle show={showPass} onToggle={() => setShowPass(v => !v)} />
                </div>
              </Field>

              <Field label="Confirmar senha" error={errors.confirmPassword}>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    className={inputCls(errors.confirmPassword) + ' pr-10'}
                  />
                  <EyeToggle show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
                </div>
              </Field>

              <Button type="submit" loading={loading} className="w-full justify-center mt-2">
                Ativar minha conta
              </Button>
            </form>
          </>
        )}
      </div>
    </Layout>
  )
}

function Layout({ children }) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Brand />
          <h1 className="font-display font-medium text-[28px] tracking-tight mt-4">Aceitar convite</h1>
          <p className="text-ink-3 text-[13px] mt-1">Você foi convidado como profissional</p>
        </div>
        {children}
      </div>
    </div>
  )
}

function ErrorBox({ message }) {
  return (
    <div className="mb-4 px-3.5 py-2.5 rounded-md bg-danger-soft border border-danger/20 text-[13px] text-danger">
      {message}
    </div>
  )
}

function Field({ label, error, children }) {
  return (
    <div className="flex flex-col gap-1.5 mb-4">
      <label className="text-[11px] text-ink-3 font-medium uppercase tracking-wider">{label}</label>
      {children}
      {error && <span className="text-[11px] text-danger">{error}</span>}
    </div>
  )
}

function inputCls(error) {
  return `h-[42px] w-full px-[14px] rounded-md border bg-surface text-ink-2 font-body text-md placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors ${error ? 'border-danger' : 'border-line'}`
}

function EyeToggle({ show, onToggle }) {
  return (
    <button type="button" onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink transition-colors cursor-pointer">
      {show ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
      )}
    </button>
  )
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  if (digits.length <= 3) return `(${digits.slice(0, 2)}) ${digits[2]}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits[2]} ${digits.slice(3)}`
  return `(${digits.slice(0, 2)}) ${digits[2]} ${digits.slice(3, 7)}-${digits.slice(7)}`
}

function Brand() {
  return <img src={logo} alt="Dauth" className="w-14 h-14 rounded-xl object-cover mx-auto" />
}
