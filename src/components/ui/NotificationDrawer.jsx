import { useEffect } from 'react'
import Icon from '@/components/ui/Icons'
import useNotificationStore from '@/store/notificationStore'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `há ${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}

const entityIcon = {
  appointment: 'cal',
  service: 'scissors',
  user: 'users',
}

export default function NotificationDrawer() {
  const { drawerOpen, notifications, unreadCount, closeDrawer, markRead, markAllRead } =
    useNotificationStore()

  useEffect(() => {
    if (!drawerOpen) return
    const handler = (e) => { if (e.key === 'Escape') closeDrawer() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [drawerOpen, closeDrawer])

  if (!drawerOpen) return null

  return (
    <>
      {/* overlay */}
      <div
        className="fixed inset-0 z-40 bg-ink/20"
        onClick={closeDrawer}
      />

      {/* drawer — bottom sheet mobile / lateral desktop */}
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-surface shadow-xl
                      md:inset-y-0 md:right-0 md:left-auto md:w-[380px] md:rounded-none md:border-l md:border-line">
        {/* alça mobile */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-line-2" />
        </div>

        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <span className="font-display font-medium text-ink text-[15px]">Notificações</span>
            {unreadCount > 0 && (
              <span className="text-[10.5px] font-mono uppercase tracking-widest bg-brand text-white rounded-full px-2 py-0.5">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[12px] font-body text-brand hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
            <button
              onClick={closeDrawer}
              className="p-1.5 rounded-md text-ink-3 hover:bg-surface-2 transition-colors"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>

        {/* lista */}
        <div className="overflow-y-auto max-h-[70vh] md:max-h-full md:h-[calc(100vh-65px)]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-ink-4">
              <Icon name="bell" size={28} />
              <p className="text-[13px] font-body">Nenhuma notificação</p>
            </div>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li
                  key={n.UUID}
                  onClick={() => !n.read_at && markRead(n.UUID)}
                  className={`flex gap-3 px-5 py-4 border-b border-line transition-colors
                    ${!n.read_at ? 'bg-brand-soft cursor-pointer hover:bg-brand/10' : 'bg-surface'}`}
                >
                  {/* ícone */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                    ${!n.read_at ? 'bg-brand text-white' : 'bg-surface-2 text-ink-3'}`}>
                    <Icon name={entityIcon[n.entity] ?? 'bell'} size={14} />
                  </div>

                  {/* conteúdo */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-body leading-snug
                      ${!n.read_at ? 'text-ink font-medium' : 'text-ink-2'}`}>
                      {n.message}
                    </p>
                    <p className="text-[11px] font-mono text-ink-4 mt-1">{timeAgo(n.created_at)}</p>
                  </div>

                  {/* bolinha não lida */}
                  {!n.read_at && (
                    <div className="flex-shrink-0 mt-1.5 w-2 h-2 rounded-full bg-brand" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
