import { Link } from 'react-router-dom'

// Aviso de aceite exibido antes de criar conta ou salão. Fonte única do texto e dos links.
export default function LegalNotice({ className = '' }) {
  const link = 'underline hover:text-ink-2 transition-colors'
  return (
    <p className={`text-[12px] leading-relaxed text-ink-3 ${className}`}>
      Ao continuar, você concorda com os{' '}
      <Link to="/termos" target="_blank" className={link}>Termos de Uso</Link> e a{' '}
      <Link to="/privacidade" target="_blank" className={link}>Política de Privacidade</Link>.
    </p>
  )
}
