import { useState, useEffect } from 'react'

const KEY = 'dauth_cookies_accepted'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(KEY)) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem(KEY, new Date().toISOString())
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-[100] flex justify-center px-4 pb-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-xl bg-surface border border-line rounded-[12px] shadow-lg px-5 py-4 flex items-center gap-4">
        <p className="flex-1 text-[13px] text-ink-3 leading-relaxed">
          Usamos cookies essenciais para manter sua sessão segura.{' '}
          <a href="/privacidade" className="text-brand hover:underline">
            Saiba mais
          </a>
          .
        </p>
        <button
          onClick={accept}
          className="shrink-0 h-[36px] px-5 rounded-md bg-brand text-white text-[13px] font-medium hover:bg-brand/90 transition-colors"
        >
          Entendi
        </button>
      </div>
    </div>
  )
}
