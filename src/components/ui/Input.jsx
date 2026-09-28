export default function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5 mb-4">
      {label && (
        <label className="text-xs text-ink-3 font-medium">{label}</label>
      )}
      <input
        className={`h-[42px] px-[14px] rounded-md border border-line bg-surface text-ink-2
          font-body text-md placeholder:text-ink-4
          focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/12 transition-colors
          ${error ? 'border-danger' : ''}
          ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}
