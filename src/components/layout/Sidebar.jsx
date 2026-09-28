import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate, useLocation, useParams } from 'react-router-dom'
import logo from '@/logo-dauth-agendamentos.png'
import Avatar from '@/components/ui/Avatar'
import Icon from '@/components/ui/Icons'
import api from '@/lib/api'
import platformApi from '@/lib/platformApi'
import useAuthStore from '@/store/authStore'
import useSalonStore from '@/store/salonStore'
import useNotificationStore from '@/store/notificationStore'
import { usePermission } from '@/hooks/usePermission'
import { NAV_ITEM_FEATURE, salonHasFeature, planRequiredFor } from '@/config/plans'
import UpgradeModal from '@/components/ui/UpgradeModal'
import { canEnterSalon } from '@/lib/salonAccess'

function NavGroup({ item, onClose }) {
  const location = useLocation()
  const isActive = location.pathname === item.to || item.children.some(c => {
    const [cPath, cQuery] = c.to.split('?')
    if (location.pathname !== cPath) return false
    if (!cQuery) return !location.search
    return location.search === '?' + cQuery
  })
  const [open, setOpen] = useState(isActive)

  useEffect(() => { if (isActive) setOpen(true) }, [isActive])

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2.5 px-2.5 py-[9px] rounded-lg text-[13.5px] transition-colors cursor-pointer
          ${isActive ? 'bg-brand-soft text-brand border border-brand/20 font-medium' : 'text-ink-2 hover:bg-surface-3 hover:text-ink'}`}
      >
        {item.icon && <Icon name={item.icon} size={16} />}
        <span className="flex-1 text-left">{item.label}</span>
        <Icon name="chevronRight" size={12} className={`transition-transform shrink-0 ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="ml-[22px] mt-0.5 flex flex-col gap-0.5 border-l border-line-2 pl-3">
          {item.children.map((child, i) => {
            const [cPath, cQuery] = child.to.split('?')
            const childActive = location.pathname === cPath && (cQuery ? location.search === '?' + cQuery : !location.search || location.search.startsWith('?appointment'))
            return (
              <NavLink
                key={i}
                to={child.to}
                onClick={onClose}
                className={`text-[13px] px-2 py-1.5 rounded-md transition-colors
                  ${childActive ? 'text-brand font-medium' : 'text-ink-3 hover:text-ink hover:bg-surface-3'}`}
              >
                {child.label}
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

const ROLE_PATH = { Admin: 'admin', Profissional: 'profissional', Usuario: 'cliente' }

function SalonSwitcher({ currentSalonId, onClose: closeSidebar }) {
  const [open, setOpen] = useState(false)
  const [salons, setSalons] = useState([])
  const [loading, setLoading] = useState(false)
  const setSalon = useSalonStore((s) => s.setSalon)
  const { user, updateUser } = useAuthStore()
  const navigate = useNavigate()
  const ref = useRef(null)
  const isOwner = user?.platformRole === 'SalonOwner'
  const manageTo = isOwner ? '/meus-saloes' : '/meus-empregos'

  useEffect(() => {
    if (!open) return
    setLoading(true)
    platformApi.get('/salon/my')
      .then(({ data }) => setSalons(Array.isArray(data) ? data : []))
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [open])

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSwitch(member) {
    setOpen(false)
    if (closeSidebar) closeSidebar()
    setSalon(
      { id: member.salonId, name: member.salon.name, slug: member.salon.slug, plan: member.salon.plan, status: member.salon.status, colorPalette: member.salon.colorPalette ?? null },
      member.role, member.id
    )
    try {
      const { data: perfil } = await api.get('/users/perfil/me', { headers: { 'x-salon-id': member.salonId } })
      let permissions = null
      if ((perfil.Role === 'Profissional' || perfil.Role === 'Admin')) {
        permissions = await api.get(`/professional/${perfil.UUID}/permissions`, {
          headers: { 'x-salon-id': member.salonId },
        }).then(r => r.data.data).catch(() => null)
      }
      updateUser({ id: perfil.UUID, publicId: perfil.UUID, role: perfil.Role, must_change_password: perfil.Must_change_password, permissions })
    } catch { }
    navigate(`/${member.salon.slug}/${ROLE_PATH[member.role] ?? 'admin'}`, { replace: true })
  }

  const others = salons.filter(m => m.salonId !== currentSalonId && canEnterSalon(m))

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Trocar salão"
        className="p-1.5 rounded-lg text-ink-4 hover:bg-surface-3 transition-colors shrink-0 cursor-pointer"
      >
        <Icon name="arrowLeftRight" size={15} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-52 bg-surface border border-line rounded-xl shadow-lg overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-line">
            <span className="text-[10.5px] font-mono uppercase tracking-widest text-ink-3">Trocar salão</span>
          </div>
          {loading ? (
            <div className="px-3 py-3 text-[12px] text-ink-3">Carregando…</div>
          ) : others.length === 0 ? (
            <div className="px-3 py-3 text-[12px] text-ink-3">Nenhum outro salão.</div>
          ) : (
            <div className="py-1">
              {others.map(member => (
                <button key={member.id} onClick={() => handleSwitch(member)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface-2 transition-colors text-left">
                  <div className="w-6 h-6 rounded-md bg-brand-soft flex items-center justify-center shrink-0">
                    <span className="font-display font-bold text-[11px] text-brand">{member.salon.name.charAt(0)}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium text-ink truncate">{member.salon.name}</div>
                    <div className="text-[10.5px] text-ink-3 font-mono">{member.role}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => { setOpen(false); if (closeSidebar) closeSidebar(); navigate(manageTo) }}
            className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-line text-[12.5px] font-medium text-brand hover:bg-surface-2 transition-colors text-left"
          >
            <Icon name={isOwner ? 'plus' : 'scissors'} size={13} />
            {isOwner ? 'Gerenciar meus salões' : 'Meus empregos'}
          </button>
        </div>
      )}
    </div>
  )
}

const SCROLL_KEY = 'dauth_sidebar_scroll'

export default function Sidebar({ navItems, footerUser, footerRole, width = '280px', onClose }) {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const { unreadCount, openDrawer } = useNotificationStore()
  const { salon } = useSalonStore()
  const navScrollRef = useRef(null)
  const { salonSlug } = useParams()
  const { can } = usePermission()
  const visibleNavItems = navItems.filter((item) => can(item.module, 'view'))
  const [upsellFeature, setUpsellFeature] = useState(null)

  // Prefixa todos os caminhos com /${salonSlug}/ e marca os itens travados pelo plano atual
  // (feature exigida presente em NAV_ITEM_FEATURE, mas o plano do salão não libera).
  const p = (path) => salonSlug ? `/${salonSlug}/${path}` : `/${path}`
  const prefixedNavItems = visibleNavItems.map(item => {
    const feature = item.to ? NAV_ITEM_FEATURE[item.to] : undefined
    const locked = feature && !salonHasFeature(salon, feature)
    return {
      ...item,
      ...(item.to ? { to: p(item.to) } : {}),
      ...(item.children ? { children: item.children.map(c => ({ ...c, to: p(c.to) })) } : {}),
      ...(locked ? { locked: true, feature } : {}),
    }
  })

  useEffect(() => {
    const el = navScrollRef.current
    if (!el) return
    const saved = sessionStorage.getItem(SCROLL_KEY)
    if (saved) el.scrollTop = parseInt(saved, 10)
    const onScroll = () => sessionStorage.setItem(SCROLL_KEY, el.scrollTop)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  async function handleLogout() {
    try { await api.post('/auth/logout') } catch { }
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside
      data-tour="sidebar"
      className="flex flex-col gap-0.5 bg-surface-2 border-r border-line px-4 py-6 h-full"
      style={{ width, minWidth: width }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-2 pb-4 mb-1 border-b border-line">
        <img src={logo} alt="Dauth" className="w-11 h-11 rounded-lg object-cover shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold text-[13.5px] leading-none truncate">Dauth Agendamentos</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-4 hover:bg-surface-3 transition-colors"
          >
            <Icon name="x" size={16} />
          </button>
        )}
      </div>

      {/* Nav items */}
      <div ref={navScrollRef} className="nav-scroll flex-1 overflow-y-auto flex flex-col gap-0.5 min-h-0">
        {prefixedNavItems.map((item, i) => {
          if (item.type === 'label') {
            return (
              <div key={i} className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 px-2.5 pt-3.5 pb-1">
                {item.label}
              </div>
            )
          }
          if (item.children) {
            return <NavGroup key={i} item={item} onClose={onClose} />
          }
          if (item.locked) {
            return (
              <button
                key={i}
                type="button"
                onClick={() => setUpsellFeature(item.feature)}
                title={`Disponível a partir do plano ${planRequiredFor(item.feature)?.label ?? 'Profissional'}`}
                className="flex items-center gap-2.5 px-2.5 py-[9px] rounded-lg text-[13.5px] text-ink-2 hover:bg-surface-3 hover:text-ink transition-colors"
              // className="flex items-center gap-2.5 px-2.5 py-[9px] rounded-lg text-[13.5px] text-ink-4 hover:bg-surface-3 hover:text-ink-3 transition-colors cursor-pointer" <-- texto mais oculto
              >
                {item.icon && <Icon name={item.icon} size={16} />}
                <span className="flex-1 text-left">{item.label}</span>
                {/* <Icon name="lock" size={13} className="shrink-0" /> <--- cadeado na feature */}
              </button>
            )
          }
          return (
            <NavLink
              key={i}
              to={item.to}
              end={item.end}
              onClick={onClose}
              {...(item.to === '/profissional/comissoes' ? { 'data-tour': 'comissoes-link' } : {})}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 py-[9px] rounded-lg text-[13.5px] text-ink-2 hover:bg-surface-3 hover:text-ink transition-colors
              ${isActive ? 'bg-brand-soft text-brand border border-brand/20 font-medium' : ''}`
              }
            >
              {item.icon && <Icon name={item.icon} size={16} />}
              {item.label}
            </NavLink>
          )
        })}
      </div>

      {upsellFeature && (
        <UpgradeModal
          salonId={salon?.id}
          defaultPlan="profissional"
          feature={upsellFeature}
          onClose={() => setUpsellFeature(null)}
          onActivated={() => { setUpsellFeature(null); window.location.reload() }}
        />
      )}

      {/* Footer */}
      {footerUser && (
        <div className="border-t border-line mt-2.5">
          <div className="flex items-center gap-2.5 p-2.5">
            <Avatar name={footerUser} index={0} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-medium truncate leading-tight">{footerUser}</div>
              <div className="text-[11px] text-ink-3 truncate">{footerRole}</div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <SalonSwitcher currentSalonId={salon?.id} onClose={onClose} />
              <button
                data-tour="notifications"
                onClick={openDrawer}
                title="Notificações"
                className="relative p-1.5 rounded-lg text-ink-4 hover:bg-surface-3 transition-colors cursor-pointer"
              >
                <Icon name="bell" size={15} />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-brand" />
                )}
              </button>
              <button
                onClick={handleLogout}
                title="Sair"
                className="p-1.5 rounded-lg text-ink-4 hover:text-danger hover:bg-danger-soft transition-colors cursor-pointer"
              >
                <Icon name="logout" size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
