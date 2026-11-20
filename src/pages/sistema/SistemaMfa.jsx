import { useState } from 'react'
import platformApi from '@/lib/platformApi'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Icon from '@/components/ui/Icons'
import logo from '@/logo-dauth-agendamentos.png'
import { errorOf } from './systemContext'

const SETUP_STEPS = ['Senha', 'QR code', 'Recuperação']
const codeInputCls = 'text-center font-mono text-xl tracking-[0.35em]'

// Porta do painel: 2º fator (app autenticador). `mode`: 'setup' (primeiro acesso) | 'verify' (já cadastrado).
// Só aparece para a conta da lista SUPERADMIN_USER_IDS; para os outros o painel nem existe.
export default function SistemaMfa({ mode, onUnlocked }) {
  return (
    <div className="min-h-screen bg-bg grid lg:grid-cols-[440px_1fr]">
      {/* Faixa da marca (só no computador) */}
      <aside className="hidden lg:flex relative overflow-hidden flex-col justify-between bg-brand-dark text-brand-ink p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 w-80 h-80 rounded-full bg-brand-ink/[0.07]" />
        <div className="pointer-events-none absolute -left-20 bottom-10 w-72 h-72 rounded-full bg-gold/15" />
        <div className="relative flex items-center gap-3">
          <img src={logo} alt="Dauth" className="w-10 h-10 rounded-lg object-cover ring-1 ring-brand-ink/20" />
          <div>
            <p className="font-display font-semibold text-[16px] leading-none">Dauth</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand-ink/55 mt-1.5">Sistema</p>
          </div>
        </div>
        <div className="relative">
          <p className="font-display text-[34px] leading-[1.15] font-semibold tracking-tight">Administração da plataforma, com acesso protegido.</p>
          <ul className="mt-8 space-y-4">
            {[
              ['shield', 'Segundo fator obrigatório', 'Só abre com o código do app autenticador.'],
              ['lock', 'Alterações pedem código recente', 'Ações sensíveis confirmam de novo, a cada 5 minutos.'],
              ['book', 'Tudo fica na auditoria', 'Quem fez, quando e por quê. Sem como apagar.'],
            ].map(([icon, title, text]) => (
              <li key={title} className="flex items-start gap-3.5">
                <span className="w-9 h-9 rounded-lg bg-brand-ink/10 grid place-items-center text-gold shrink-0"><Icon name={icon} size={17} /></span>
                <span>
                  <span className="block text-[14px] font-medium">{title}</span>
                  <span className="block text-[12.5px] text-brand-ink/65 mt-0.5">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative font-mono text-[10.5px] uppercase tracking-[0.2em] text-brand-ink/45">Sistema de agendamentos</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-6 justify-center">
            <img src={logo} alt="Dauth" className="w-9 h-9 rounded-lg object-cover" />
            <span className="font-display font-semibold text-[15px]">Dauth · Sistema</span>
          </div>
          <div className="bg-surface border border-line rounded-xl shadow-sm p-6 sm:p-8 animate-rise">
            {mode === 'setup' ? <Setup onUnlocked={onUnlocked} /> : <Verify onUnlocked={onUnlocked} />}
          </div>
        </div>
      </main>
    </div>
  )
}

const Title = ({ icon, children }) => (
  <>
    <span className="w-11 h-11 rounded-xl grid place-items-center bg-brand-soft text-brand-soft-ink mb-4"><Icon name={icon} size={20} /></span>
    <h1 className="font-display text-[24px] font-semibold text-ink tracking-tight mb-2">{children}</h1>
  </>
)

function Stepper({ current }) {
  return (
    <ol className="flex items-center gap-2 mb-6" aria-label="Etapas do cadastro">
      {SETUP_STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2 flex-1 last:flex-none">
          <span className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-semibold shrink-0 ${i <= current ? 'bg-brand text-brand-ink' : 'bg-surface-3 text-ink-3'}`}>
            {i < current ? <Icon name="check" size={12} /> : i + 1}
          </span>
          <span className={`text-[11.5px] hidden sm:inline ${i === current ? 'text-ink font-medium' : 'text-ink-3'}`}>{label}</span>
          {i < SETUP_STEPS.length - 1 && <span className={`h-px flex-1 ${i < current ? 'bg-brand' : 'bg-line'}`} />}
        </li>
      ))}
    </ol>
  )
}

function Verify({ onUnlocked }) {
  const [recovery, setRecovery] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await platformApi.post('/system/mfa/verify', recovery ? { recoveryCode: code } : { code })
      onUnlocked()
    } catch (err) {
      setError(errorOf(err, 'Não foi possível confirmar o código.'))
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <Title icon="lock">Confirme o acesso</Title>
      <p className="text-[13.5px] text-ink-2 mb-6 leading-relaxed">
        {recovery ? 'Digite um dos códigos de recuperação (cada um vale uma vez).' : 'Digite o código de 6 dígitos do app autenticador.'}
      </p>
      <Input label={recovery ? 'Código de recuperação' : 'Código'} value={code} onChange={e => setCode(e.target.value)}
        inputMode={recovery ? 'text' : 'numeric'} autoComplete="one-time-code" autoFocus maxLength={recovery ? 12 : 7}
        placeholder={recovery ? 'xxxxx-xxxxx' : '000000'} error={error} className={recovery ? 'font-mono' : codeInputCls} />
      <Button type="submit" loading={loading} disabled={code.replace(/[\s-]/g, '').length < 6} className="w-full justify-center">Entrar</Button>
      <button type="button" onClick={() => { setRecovery(r => !r); setCode(''); setError(null) }}
        className="mt-5 text-[12.5px] text-ink-3 hover:text-ink underline underline-offset-2 cursor-pointer">
        {recovery ? 'Usar o código do app' : 'Perdi o acesso ao app'}
      </button>
    </form>
  )
}

function Setup({ onUnlocked }) {
  const [step, setStep] = useState('password') // password → scan → recovery
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [enrollment, setEnrollment] = useState(null)
  const [recoveryCodes, setRecoveryCodes] = useState([])
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function run(fn) {
    setLoading(true)
    setError(null)
    try { await fn() } catch (err) { setError(errorOf(err, 'Algo deu errado. Tente de novo.')) } finally { setLoading(false) }
  }

  const start = (e) => { e.preventDefault(); run(async () => { setEnrollment((await platformApi.post('/system/mfa/setup', { password })).data); setStep('scan') }) }
  const confirm = (e) => { e.preventDefault(); run(async () => { setRecoveryCodes((await platformApi.post('/system/mfa/confirm', { code })).data.recoveryCodes); setStep('recovery') }) }

  if (step === 'password') {
    return (
      <form onSubmit={start}>
        <Stepper current={0} />
        <Title icon="shield">Proteja o painel</Title>
        <p className="text-[13.5px] text-ink-2 mb-6 leading-relaxed">Para usar o painel é preciso um app autenticador (Google Authenticator, Authy, 1Password…). Confirme a senha da sua conta para começar.</p>
        <Input label="Senha da sua conta" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" autoFocus error={error} />
        <Button type="submit" loading={loading} disabled={!password} className="w-full justify-center">Continuar</Button>
      </form>
    )
  }

  if (step === 'scan') {
    return (
      <form onSubmit={confirm}>
        <Stepper current={1} />
        <Title icon="qr">Leia o QR code</Title>
        <p className="text-[13.5px] text-ink-2 mb-5 leading-relaxed">Abra o app autenticador, adicione uma conta e leia o código abaixo. Depois digite o código de 6 dígitos que o app mostrar.</p>
        <div className="mx-auto mb-4 w-fit rounded-xl border border-line bg-surface p-3 shadow-xs">
          <img src={enrollment.qr} alt="QR code do app autenticador" className="rounded-md" width={200} height={200} />
        </div>
        <p className="text-[11.5px] text-ink-3 text-center mb-5">Sem câmera? Digite a chave: <span className="font-mono text-ink break-all select-all">{enrollment.secret}</span></p>
        <Input label="Código de 6 dígitos" value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="000000" autoFocus error={error} className={codeInputCls} />
        <Button type="submit" loading={loading} disabled={code.replace(/\D/g, '').length < 6} className="w-full justify-center">Ativar</Button>
      </form>
    )
  }

  return (
    <div>
      <Stepper current={2} />
      <Title icon="book">Guarde os códigos de recuperação</Title>
      <p className="text-[13.5px] text-ink-2 mb-5 leading-relaxed">Se perder o celular, cada código abaixo vale uma entrada. <strong>Eles não aparecem de novo.</strong> Guarde num gerenciador de senhas ou impresso.</p>
      <div className="grid grid-cols-2 gap-2 mb-3 font-mono text-[13px] text-ink">
        {recoveryCodes.map(c => <span key={c} className="rounded-md bg-surface-2 border border-line px-3 py-2 text-center select-all">{c}</span>)}
      </div>
      <button type="button" onClick={() => navigator.clipboard?.writeText(recoveryCodes.join('\n'))} className="text-[12.5px] text-brand font-medium hover:underline cursor-pointer mb-5">Copiar todos</button>
      <label className="flex items-start gap-2.5 text-[13px] text-ink-2 mb-5 cursor-pointer rounded-lg bg-surface-2 border border-line-2 p-3">
        <input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} className="mt-0.5 accent-brand" />
        Guardei os códigos num lugar seguro
      </label>
      <Button onClick={onUnlocked} disabled={!saved} className="w-full justify-center">Abrir o painel</Button>
    </div>
  )
}
