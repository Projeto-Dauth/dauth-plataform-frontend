import { useEffect } from 'react'
import { useRouteError } from 'react-router-dom'
import { reportError } from '@/lib/errorReporter'

// Tela quando um componente quebra (errorElement da rota raiz). Registra o erro no log do sistema.
export default function RouteError() {
  const error = useRouteError()

  useEffect(() => {
    reportError(error, { source: 'render', context: error?.status ? `HTTP ${error.status}` : undefined })
  }, [error])

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <p className="eyebrow mb-3">Erro</p>
        <h1 className="font-display text-2xl font-medium text-ink mb-2">Algo deu errado nesta tela</h1>
        <p className="text-ink-2 text-md mb-6">O problema foi registrado. Recarregue a página para tentar de novo.</p>
        <button onClick={() => window.location.reload()} className="text-brand underline text-md cursor-pointer">
          Recarregar a página
        </button>
      </div>
    </div>
  )
}
