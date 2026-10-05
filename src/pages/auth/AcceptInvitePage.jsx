import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import Button from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import platformApi from '@/lib/platformApi'
import useAuthStore from '@/store/authStore'
import logo from '@/logo-dauth-agendamentos.png'
import { formatPhone } from '@/lib/phone'

// Link do convite para a equipe (/auth/accept-invite?token=). A conta não foi criada no convite:
// - logado → Aceitar / Recusar;
// - não logado → "Já tenho conta" (login volta pra cá) ou "Criar conta" (só se o convite não é de uma conta específica).
//   A conta criada aqui só ativa ao confirmar o telefone pelo WhatsApp; aí o convite é aceito sozinho.
export default function AcceptInvitePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { user, isAuthenticated } = useAuthStore()

  const [info, setInfo] = useState(null) // { salonName, name, email, status, expired, forExistingAccount }
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [infoError, setInfoError] = useState(null)
  const [mode, setMode] = useState('choose') // choose | register
  const [done, setDone] = useState(null) // 'accepted' | 'declined'
  const [verifyPhone, setVerifyPhone] = useState(null) // telefone da conta criada aguardando confirmação
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const loginUrl = `/login?redirect=${encodeURIComponent(`/auth/accept-invite?token=${token}`)}`
  const homeUrl = user?.platformRole === 'SalonOwner' ? '/meus-saloes' : '/meus-empregos'

  useEffect(() => {
    if (!token) { setLoadingInfo(false); return }
    platformApi.get(`/invitations/${token}`)
      .then(r => setInfo(r.data))
      .catch(err => setInfoError(err.response?.data?.error ?? 'Convite inválido ou expirado.'))
      .finally(() => setLoadingInfo(false))
  }, [token])

  async function respond(action) {
    setBusy(action)
    setError(null)
    try {
      await platformApi.post(`/invitations/${token}/${action}`)
      setDone(action === 'accept' ? 'accepted' : 'declined')
    } catch (err) {
      setError(err.response?.data?.error ?? 'Não foi possível responder ao convite.')
    } finally {
      setBusy(null)
    }
  }

  if (!token) return <Layout><Message text="O link de convite está incompleto. Peça ao salão que envie de novo." /></Layout>
  if (loadingInfo) return <PageSpinner />
  if (infoError) return <Layout><Message text={infoError} /></Layout>

  if (done === 'accepted') {
    return (
      <Layout title="Convite aceito!">
        <Card>
          <p className="text-[13.5px] text-ink-2 mb-5">Você agora faz parte da equipe de <strong>{info.salonName}</strong>.</p>
          <Button onClick={() => navigate(homeUrl, { replace: true })} className="w-full justify-center">Ir para o salão</Button>
        </Card>
      </Layout>
    )
  }
  if (verifyPhone) {
    return <Layout title="Confirme seu WhatsApp"><ConfirmPhone phone={verifyPhone} salonName={info.salonName} /></Layout>
  }
  if (done === 'declined') {
    return <Layout title="Convite recusado"><Message text={`Você recusou o convite de ${info.salonName}.`} link={{ to: '/', label: 'Voltar' }} /></Layout>
  }
  if (info.status === 'accepted') return <Layout><Message text="Este convite já foi aceito." link={{ to: '/login', label: 'Entrar' }} /></Layout>
  if (info.status === 'declined') return <Layout><Message text="Este convite foi recusado." /></Layout>
  if (info.expired) return <Layout><Message text={`Este convite expirou. Peça para ${info.salonName} enviar um novo.`} /></Layout>

  const intro = (
    <p className="text-[13.5px] text-ink-2 mb-5">
      <strong>{info.salonName}</strong> convidou você para fazer parte da equipe como <strong>profissional</strong>.
    </p>
  )

  if (isAuthenticated) {
    return (
      <Layout>
        <Card>
          {intro}
          <p className="text-[12px] text-ink-3 mb-5">Você está conectado como <strong className="text-ink-2">{user?.name}</strong>.</p>
          {error && <ErrorBox message={error} />}
          <div className="flex flex-col gap-2">
            <Button onClick={() => respond('accept')} loading={busy === 'accept'} disabled={!!busy} className="w-full justify-center">Aceitar convite</Button>
            <Button variant="ghost" onClick={() => respond('decline')} loading={busy === 'decline'} disabled={!!busy} className="w-full justify-center">Recusar</Button>
          </div>
        </Card>
      </Layout>
    )
  }

  if (mode === 'register') {
    return (
      <Layout>
        <RegisterForm
          token={token}
          info={info}
          loginUrl={loginUrl}
          onBack={() => setMode('choose')}
          onDone={({ phone }) => setVerifyPhone(phone)}
        />
      </Layout>
    )
  }

  return (
    <Layout>
      <Card>
        {intro}
        <div className="flex flex-col gap-2">
          <Button onClick={() => navigate(loginUrl)} className="w-full justify-center">Já tenho conta — entrar</Button>
          {!info.forExistingAccount && (
            <Button variant="outline" onClick={() => setMode('register')} className="w-full justify-center">Criar minha conta</Button>
          )}
        </div>
        <p className="text-[12px] text-ink-3 mt-4">
          {info.forExistingAccount
            ? 'Entre com seu telefone e senha para aceitar.'
            : 'Se você já agenda em algum salão pelo Dauth, entre com o telefone e a senha que você já usa.'}
        </p>
      </Card>
    </Layout>
  )
}

function RegisterForm({ token, info, loginUrl, onBack, onDone }) {
  const [name, setName] = useState(info.name ?? '')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [hasAccount, setHasAccount] = useState(false)

  function validate() {
    const e = {}
    if (!name.trim()) e.name = 'Nome obrigatório'
    if (!/^\(\d{2}\) \d \d{4}-\d{4}$/.test(phone)) e.phone = 'Formato: (11) 9 9999-9999'
    if (password.length < 8) e.password = 'Mínimo 8 caracteres'
    if (password !== confirm) e.confirm = 'As senhas não coincidem'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setHasAccount(false)
    try {
      await platformApi.post(`/invitations/${token}/register`, { name: name.trim(), phone, password })
      onDone({ phone })
    } catch (err) {
      setErrors({ api: err.response?.data?.error ?? 'Erro ao criar conta.' })
      setHasAccount(err.response?.data?.code === 'HAS_ACCOUNT')
      setLoading(false)
    }
  }

  return (
    <Card>
      <p className="text-[13px] text-ink-3 mb-5">
        Crie sua conta para entrar na equipe de <strong className="text-ink-2">{info.salonName}</strong>.
        {info.email && <> Seu email será <span className="font-mono text-ink-2">{info.email}</span>.</>}
      </p>
      {errors.api && <ErrorBox message={errors.api} />}
      {hasAccount && (
        <Link to={loginUrl} className="block mb-4 text-[13px] text-brand font-medium hover:underline">Entrar com minha conta →</Link>
      )}
      <form onSubmit={handleSubmit} noValidate autoComplete="off">
        <Field label="Nome completo" error={errors.name}>
          <input value={name} onChange={e => setName(e.target.value)} className={inputCls(errors.name)} />
        </Field>
        <Field label="Telefone (será seu login)" error={errors.phone}>
          <input type="tel" value={phone} onChange={e => setPhone(formatPhone(e.target.value))} placeholder="(11) 9 9999-9999" className={inputCls(errors.phone)} />
        </Field>
        <Field label="Senha" error={errors.password}>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" className={inputCls(errors.password)} />
        </Field>
        <Field label="Confirmar senha" error={errors.confirm}>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className={inputCls(errors.confirm)} />
        </Field>
        <Button type="submit" loading={loading} className="w-full justify-center mt-1">Criar conta</Button>
        <button type="button" onClick={onBack} className="block w-full mt-3 text-[13px] text-ink-3 hover:text-ink transition-colors cursor-pointer">Voltar</button>
      </form>
    </Card>
  )
}

// Conta criada pelo link: falta confirmar o telefone. Ao confirmar, o convite é aceito e a pessoa entra normalmente.
function ConfirmPhone({ phone, salonName }) {
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState(null)

  async function resend() {
    setSending(true)
    setMsg(null)
    try {
      await platformApi.post('/auth/resend-verification-phone', { phone })
      setMsg('Link reenviado.')
    } catch {
      setMsg('Não foi possível reenviar agora. Tente de novo em instantes.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <p className="text-[13.5px] text-ink-2 mb-2">
        Enviamos um link de confirmação para o WhatsApp <strong className="font-mono">{phone}</strong>.
      </p>
      <p className="text-[13px] text-ink-3 mb-5">
        Abra o link para ativar sua conta. Assim que confirmar, você entra na equipe de <strong className="text-ink-2">{salonName}</strong> e já pode fazer login com esse telefone.
      </p>
      <Link to="/login" className="inline-flex items-center justify-center h-[42px] px-6 rounded-md bg-brand text-white font-medium text-[14px] hover:bg-brand-dark transition-colors w-full">
        Ir para o login
      </Link>
      <button type="button" onClick={resend} disabled={sending} className="block w-full mt-3 text-[13px] text-ink-3 hover:text-ink transition-colors cursor-pointer disabled:opacity-60">
        {sending ? 'Reenviando…' : 'Não recebeu? Reenviar link'}
      </button>
      {msg && <p className="text-[12px] text-ink-3 text-center mt-2">{msg}</p>}
    </Card>
  )
}

function Layout({ title = 'Convite para a equipe', children }) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Dauth" className="w-14 h-14 rounded-xl object-cover mx-auto" />
          <h1 className="font-display font-medium text-[26px] tracking-tight mt-4 text-center">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  )
}

function Card({ children }) {
  return <div className="bg-surface border border-line rounded-[14px] p-5 md:p-7">{children}</div>
}

function Message({ text, link = { to: '/login', label: 'Ir para o login' } }) {
  return (
    <Card>
      <p className="text-[13.5px] text-ink-2 text-center">{text}</p>
      <Link to={link.to} className="block mt-4 text-[13px] text-ink-3 hover:text-ink transition-colors text-center">{link.label}</Link>
    </Card>
  )
}

function ErrorBox({ message }) {
  return <div className="mb-4 px-3.5 py-2.5 rounded-md bg-danger-soft border border-danger/20 text-[13px] text-danger">{message}</div>
}

function Field({ label, error, children }) {
  return (
    // <label> em volta: o texto vira o nome acessível do campo (e clicar nele foca o campo)
    <label className="flex flex-col gap-1.5 mb-4">
      <span className="text-[11px] text-ink-3 font-medium uppercase tracking-wider">{label}</span>
      {children}
      {error && <span className="text-[11px] text-danger">{error}</span>}
    </label>
  )
}

function inputCls(error) {
  return `h-[42px] w-full px-[14px] rounded-md border bg-surface text-ink-2 font-body text-md placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors ${error ? 'border-danger' : 'border-line'}`
}
