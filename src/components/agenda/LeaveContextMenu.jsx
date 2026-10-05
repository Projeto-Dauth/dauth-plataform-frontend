import { useEffect, useRef } from 'react'
import Icon from '@/components/ui/Icons'

export function LeaveContextMenu({ leave, x, y, onClose, onEdit, onRemove }) {
  const menuRef = useRef(null)
  useEffect(() => {
    function handle(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('keydown', handle)
    return () => { document.removeEventListener('mousedown', handle); document.removeEventListener('keydown', handle) }
  }, [onClose])
  const menuW = 180, menuH = 116
  const adjX = x + menuW > window.innerWidth ? x - menuW : x
  const adjY = y + menuH > window.innerHeight ? y - menuH : y
  return (
    <div ref={menuRef} className="fixed z-50 bg-surface border border-line rounded-xl shadow-lg py-1.5 min-w-[180px]" style={{ left: adjX, top: adjY }}>
      <div className="px-3.5 py-2 border-b border-line mb-1">
        <div className="font-medium text-[12.5px]">Folga</div>
        {leave.Reason && <div className="text-[11px] text-ink-3 truncate">{leave.Reason}</div>}
      </div>
      <button
        onClick={() => { onEdit(leave); onClose() }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-ink-2 hover:bg-surface-2 transition-colors cursor-pointer"
      >
        <Icon name="edit" size={13} />
        Editar folga
      </button>
      <button
        onClick={() => { onRemove(leave); onClose() }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-danger hover:bg-surface-2 transition-colors cursor-pointer"
      >
        <Icon name="trash" size={13} />
        Remover folga
      </button>
    </div>
  )
}
