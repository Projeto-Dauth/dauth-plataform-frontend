import Icon from '@/components/ui/Icons'

export default function PaginationControls({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between gap-3 mt-4 px-1">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12.5px] text-ink-2 border border-line hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors cursor-pointer"
      >
        <Icon name="arrowLeft" size={12} />
        Anterior
      </button>
      <span className="font-mono text-[11.5px] text-ink-3">Página {page} de {totalPages}</span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12.5px] text-ink-2 border border-line hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors cursor-pointer"
      >
        Próxima
        <Icon name="arrowRight" size={12} />
      </button>
    </div>
  )
}
