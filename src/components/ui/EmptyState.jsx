import Icon from '@/components/ui/Icons'
import Button from '@/components/ui/Button'

export default function EmptyState({ icon = 'search', title, description, action, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <div className="w-12 h-12 rounded-xl bg-surface-2 border border-line flex items-center justify-center mb-4 text-ink-3">
        <Icon name={icon} size={22} />
      </div>
      <div className="font-display font-medium text-[16px] tracking-tight mb-1">{title}</div>
      {description && (
        <p className="text-[13px] text-ink-3 max-w-xs leading-relaxed mb-5">{description}</p>
      )}
      {action && (
        <Button size="sm" onClick={action}>{actionLabel}</Button>
      )}
    </div>
  )
}
