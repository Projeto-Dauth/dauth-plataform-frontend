export default function Card({ children, elevated = false, className = '' }) {
  return (
    <div
      className={`bg-surface border border-line rounded-lg p-6
        ${elevated ? 'shadow-sm' : ''}
        ${className}`}
    >
      {children}
    </div>
  )
}
