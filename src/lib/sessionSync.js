// A sessão (cookie do Better Auth) é uma só por navegador: entrar com outra conta em uma aba
// troca a conta de todas as abas abertas. Esta é a fonte única do aviso entre abas.
// O evento `storage` só dispara nas OUTRAS abas, então a aba que fez o login não se avisa.
const KEY = 'dauth-session-event'

export function announceSessionChange(type, name) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ type, name: name ?? null, at: Date.now() }))
  } catch {
    // localStorage indisponível (modo privado restrito): sem aviso, nada quebra
  }
}

// Chama `onChange({ type: 'login' | 'logout', name })` quando outra aba entra ou sai. Devolve o cancelamento.
export function onSessionChange(onChange) {
  function handler(e) {
    if (e.key !== KEY || !e.newValue) return
    try {
      onChange(JSON.parse(e.newValue))
    } catch {
      // valor corrompido: ignora
    }
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}
