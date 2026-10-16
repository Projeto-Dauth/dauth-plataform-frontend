import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '@/components/ui/Icons'
import platformApi from '@/lib/platformApi'
import { canEnterSalon } from '@/lib/salonAccess'
import { enterSalon } from '@/lib/enterSalon'
import JoinByCodeModal from '@/components/salon/JoinByCodeModal'

// "Trocar salão": lista os outros salões da pessoa, permite adicionar um por código e leva a Meus salões.
// Usado no menu do salão (ícone) e no menu do cliente (`label` mostra a linha com texto).
export default function SalonSwitcher({ currentSalonId, onClose: closeSidebar, label }) {
  const [open, setOpen] = useState(false)
  const [salons, setSalons] = useState([])
  const [loading, setLoading] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const navigate = useNavigate()
  const ref = useRef(null)

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
    await enterSalon(member, navigate)
  }

  const others = salons.filter(m => m.salonId !== currentSalonId && canEnterSalon(m))

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Trocar salão"
        className={label
          ? 'w-full flex items-center gap-2.5 px-2.5 py-[9px] rounded-lg text-[13.5px] text-ink-3 hover:bg-surface-3 hover:text-ink transition-colors cursor-pointer'
          : 'p-1.5 rounded-lg text-ink-4 hover:bg-surface-3 transition-colors shrink-0 cursor-pointer'}
      >
        <Icon name="arrowLeftRight" size={label ? 16 : 15} />
        {label}
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
            onClick={() => { setOpen(false); setJoinOpen(true) }}
            className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-line text-[12.5px] font-medium text-ink-2 hover:bg-surface-2 transition-colors text-left"
          >
            <Icon name="plus" size={13} />
            Adicionar com código
          </button>
          <button
            onClick={() => { setOpen(false); if (closeSidebar) closeSidebar(); navigate('/meus-saloes') }}
            className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-line text-[12.5px] font-medium text-brand hover:bg-surface-2 transition-colors text-left"
          >
            <Icon name="scissors" size={13} />
            Meus salões
          </button>
        </div>
      )}

      {joinOpen && (
        <JoinByCodeModal
          onClose={() => setJoinOpen(false)}
          onJoined={(member) => { setJoinOpen(false); if (closeSidebar) closeSidebar(); enterSalon(member, navigate) }}
        />
      )}
    </div>
  )
}
