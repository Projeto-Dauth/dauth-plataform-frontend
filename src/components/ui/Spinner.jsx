const sizes = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-9 h-9 border-[3px]',
}

export default function Spinner({ size = 'md', className = '' }) {
  return (
    <div
      className={`rounded-full border-line-3 border-t-brand animate-spin
        ${sizes[size]} ${className}`}
    />
  )
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-full min-h-[240px]">
      <Spinner size="lg" />
    </div>
  )
}
