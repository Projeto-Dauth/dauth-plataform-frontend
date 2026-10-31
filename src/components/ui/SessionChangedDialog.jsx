import { useEffect, useState } from 'react'
import useAuthStore from '@/store/authStore'
import useSalonStore from '@/store/salonStore'
import { onSessionChange } from '@/lib/sessionSync'
import Button from '@/components/ui/Button'

// Avisa esta aba quando outra aba do mesmo navegador entrou ou saiu de uma conta
// (o cookie de sessão é compartilhado, então esta aba já não pertence mais à conta que mostra).
// O aviso não pode ser dispensado: a aba fica travada até a pessoa entrar de novo.
export default function SessionChangedDialog() {
  const [change, setChange] = useState(null)

  useEffect(
    () =>
      onSessionChange((event) => {
        // Aba sem login (páginas públicas) não tem nada a perder
        if (useAuthStore.getState().isAuthenticated) setChange(event)
      }),
    []
  )

  // Chama a atenção de quem está em outra aba: o título da aba pisca até voltar para esta
  useEffect(() => {
    if (!change) return
    const original = document.title
    const alert = 'Sessão alterada — entre novamente'
    let on = true
    const timer = setInterval(() => {
      document.title = document.hidden && on ? alert : original
      on = !on
    }, 1000)
    return () => {
      clearInterval(timer)
      document.title = original
    }
  }, [change])

  if (!change) return null

  const loggedOut = change.type === 'logout'

  function relogin() {
    // Encerra só o estado local desta aba (sem avisar as outras) e manda entrar de novo
    useAuthStore.setState({ user: null, isAuthenticated: false })
    useSalonStore.getState().clearSalon()
    const back = window.location.pathname + window.location.search
    window.location.assign(`/login?redirect=${encodeURIComponent(back)}`)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-ink/50 backdrop-blur-[2px]">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-changed-title"
        className="animate-fade-up w-full max-w-[420px] bg-surface border border-line rounded-lg shadow-lg p-6"
      >
        <h2 id="session-changed-title" className="text-[15px] font-medium text-ink mb-1">
          {loggedOut ? 'Sua sessão foi encerrada' : 'Outra conta foi acessada'}
        </h2>
        <p className="text-[13px] text-ink-3 leading-relaxed mb-4">
          {loggedOut
            ? 'Você saiu da conta em outra aba deste navegador. Para continuar usando esta aba, entre novamente.'
            : `${change.name ? `${change.name} entrou` : 'Uma conta entrou'} em outra aba deste navegador. Para continuar usando esta aba, entre novamente.`}
        </p>
        <div className="flex justify-end">
          <Button onClick={relogin}>Entrar novamente</Button>
        </div>
      </div>
    </div>
  )
}
