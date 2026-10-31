import useSalonStore from '@/store/salonStore'

// Envia erros do navegador para o log do sistema (painel /sistema → Erros, origem "frontend").
// Fonte única: tela que quebra (RouteError), window.onerror e promessa rejeitada sem tratamento.
// Nunca lança e nunca mostra nada para o usuário. Erros de API (axios) ficam de fora: o backend já registra os 5xx.

const ENDPOINT = `${import.meta.env.VITE_PLATFORM_URL}/client-errors`
const MAX_PER_PAGE_LOAD = 20
const REPEAT_WINDOW_MS = 60 * 1000

// Ruído de navegador/extensão que não é bug do sistema
const IGNORED = [/ResizeObserver loop/i, /Script error\.?$/i, /^Non-Error promise rejection/i]

let sent = 0
const lastSent = new Map() // tipo + mensagem → quando foi enviada

export function reportError(error, { source = 'window', context } = {}) {
  try {
    if (error?.isAxiosError) return
    const message = String(error?.message ?? error ?? '').slice(0, 1000)
    if (!message || IGNORED.some(re => re.test(message))) return

    // A chave inclui o tipo: em dev o React repassa o erro da tela também ao window (chega antes), e o relato
    // "render" (tela quebrou) não pode ser descartado como repetição dele
    const key = `${source}|${message}`
    const now = Date.now()
    if (now - (lastSent.get(key) ?? 0) < REPEAT_WINDOW_MS) return
    if (sent >= MAX_PER_PAGE_LOAD) return
    lastSent.set(key, now)
    sent++

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // vincula a conta se houver sessão
      keepalive: true,
      body: JSON.stringify({
        source,
        context,
        message,
        stack: typeof error?.stack === 'string' ? error.stack.slice(0, 4000) : null,
        path: window.location.pathname, // sem query string (pode ter token)
        salonId: useSalonStore.getState().salon?.id ?? null,
      }),
    }).catch(() => {})
  } catch { /* o relato de erro nunca pode quebrar a tela */ }
}

// Liga a captura global (chamado uma vez no main.jsx)
export function installErrorReporter() {
  window.addEventListener('error', (event) => {
    // Script de outro domínio (extensão do navegador, widget de terceiro) não é nosso
    if (event.filename && !event.filename.startsWith(window.location.origin)) return
    reportError(event.error ?? event.message, { source: 'window', context: event.filename ? `${event.filename}:${event.lineno}` : undefined })
  })
  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, { source: 'promise' })
  })
}
