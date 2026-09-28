import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-center">
        <p className="eyebrow mb-3">404</p>
        <h1 className="font-display text-2xl font-medium text-ink mb-2">Página não encontrada</h1>
        <p className="text-ink-2 text-md mb-6">O endereço que você acessou não existe ainda.</p>
        <Link to="/" className="text-brand underline text-md">Voltar ao início</Link>
      </div>
    </div>
  )
}
