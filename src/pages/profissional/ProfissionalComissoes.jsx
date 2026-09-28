import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Sidebar from '@/components/layout/Sidebar'
import Avatar from '@/components/ui/Avatar'
import Icon from '@/components/ui/Icons'
import { PageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import useAuthStore from '@/store/authStore'
import api from '@/lib/api'
import { navItemsByRole } from '@/config/navItems'
import MoneyValue from '@/components/ui/MoneyValue'

const navItems = navItemsByRole['Profissional']

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const PRESETS = [
  { key: 'dia', label: 'Dia' },
  { key: 'semana', label: 'Semana' },
  { key: 'quinzena', label: 'Quinzena' },
  { key: 'mes', label: 'Mês' },
]

function toLocalDateStr(date) {
  return date.toLocaleDateString('en-CA')
}

// Dia/semana/quinzena são sempre relativos a hoje; "mês" usa o mês/ano escolhido nos
// selects, para o profissional conseguir conferir um mês fechado anterior.
function getDateRange(preset) {
  const today = new Date()
  const to = toLocalDateStr(today)

  if (preset === 'dia') return { from: to, to }

  if (preset === 'semana') {
    const day = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((day + 6) % 7))
    return { from: toLocalDateStr(monday), to }
  }

  const start = new Date(today)
  start.setDate(today.getDate() - 14)
  return { from: toLocalDateStr(start), to }
}

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)
}

function formatDate(iso) {
  if (!iso) return '—'
  // Data pura (YYYY-MM-DD, ex: data do agendamento) NÃO pode passar por new Date(): o JS lê como meia-noite UTC
  // e no Brasil (UTC-3) exibe o dia anterior. Timestamps com hora (data do pagamento) continuam via Date.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.split('-').reverse().join('/')
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR')
}

export default function ProfissionalComissoes() {
  const { user } = useAuthStore()
  const now = new Date()
  const [preset, setPreset] = useState('mes')
  const [selMonth, setSelMonth] = useState(now.getMonth())
  const [selYear, setSelYear] = useState(now.getFullYear())
  const [data, setData] = useState([])
  const [totais, setTotais] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statusTab, setStatusTab] = useState('apagar') // 'apagar' | 'pagas'

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i)
  const monthKey = `${selYear}-${String(selMonth + 1).padStart(2, '0')}`

  const query = preset === 'mes'
    ? `month=${monthKey}`
    : (({ from, to }) => `from=${from}&to=${to}`)(getDateRange(preset))

  useEffect(() => {
    setLoading(true)
    api.get(`/transaction/my-commissions?${query}`)
      .then(res => {
        setData(res.data.data ?? [])
        setTotais(res.data.totais ?? null)
      })
      .catch(() => { setData([]); setTotais(null) })
      .finally(() => setLoading(false))
  }, [query])

  const aPagar = data.filter(row => !row.commission_paid)
  const pagas = data.filter(row => row.commission_paid)
  const listaAtual = statusTab === 'apagar' ? aPagar : pagas
  const totalComissaoAtual = listaAtual.reduce((sum, r) => sum + (r.commission_amount ?? 0), 0)
  const totalServicoAtual = listaAtual.reduce((sum, r) => sum + (r.gross_amount ?? 0), 0)

  const sidebar = (
    <Sidebar navItems={navItems} footerUser={user?.name} footerRole="Profissional">Profissional</Sidebar>
  )

  return (
    <AppLayout sidebar={sidebar}>
      <div className="flex justify-between items-end mb-5 md:mb-6">
        <div>
          <h3 className="font-display font-medium text-[22px] md:text-[26px] tracking-tight">Minhas comissões</h3>
          <p className="text-[12px] md:text-[13px] text-ink-3 mt-1">
            Acompanhe o que você vai receber por período
          </p>
        </div>
      </div>

      {/* Filtro de período */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium border transition-colors cursor-pointer ${
              preset === p.key
                ? 'bg-brand text-white border-brand'
                : 'bg-surface text-ink-3 border-line hover:border-ink-3'
            }`}>
            {p.label}
          </button>
        ))}

        {preset === 'mes' && (
          <>
            <select
              value={selMonth}
              onChange={e => setSelMonth(Number(e.target.value))}
              className="h-[38px] px-3 rounded-lg border border-line bg-surface text-ink-2 text-[13px] font-body focus:outline-none focus:border-brand cursor-pointer"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
            <select
              value={selYear}
              onChange={e => setSelYear(Number(e.target.value))}
              className="h-[38px] px-3 rounded-lg border border-line bg-surface text-ink-2 text-[13px] font-body focus:outline-none focus:border-brand cursor-pointer"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {loading ? <PageSpinner /> : (
        <>
          {/* Cards de totais */}
          {totais && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-surface border border-line rounded-xl p-5 flex flex-col gap-1.5">
                <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4">Atendimentos</span>
                <span className="text-[26px] font-serif font-light leading-none tracking-wide text-ink">{totais.atendimentos}</span>
              </div>
              <div className="bg-brand border border-brand rounded-xl p-5 flex flex-col gap-1.5">
                <span className="font-mono text-[10.5px] uppercase tracking-widest text-white/70">Comissão a receber</span>
                <span className="text-[22px] font-serif font-light leading-none tracking-wide text-white"><MoneyValue>{formatCurrency(totais.commission_pending)}</MoneyValue></span>
              </div>
              <div className="bg-surface border border-line rounded-xl p-5 flex flex-col gap-1.5">
                <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4">Já repassado</span>
                <span className="text-[22px] font-serif font-light leading-none tracking-wide text-success"><MoneyValue>{formatCurrency(totais.commission_repassada)}</MoneyValue></span>
              </div>
            </div>
          )}

          {/* Toggle A pagar / Pagas */}
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => setStatusTab('apagar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium border transition-colors cursor-pointer ${
                statusTab === 'apagar'
                  ? 'bg-warning/10 text-warning border-warning'
                  : 'bg-surface text-ink-3 border-line hover:border-ink-3'
              }`}>
              A pagar
              {statusTab === 'apagar' && (
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-full bg-warning/20 text-warning">
                  {aPagar.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setStatusTab('pagas')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium border transition-colors cursor-pointer ${
                statusTab === 'pagas'
                  ? 'bg-success/10 text-success border-success/40'
                  : 'bg-surface text-ink-3 border-line hover:border-ink-3'
              }`}>
              Pagas
              {statusTab === 'pagas' && (
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-full bg-success/20 text-success">
                  {pagas.length}
                </span>
              )}
            </button>
          </div>

          {listaAtual.length === 0 ? (
            <EmptyState
              icon="cash"
              title={statusTab === 'apagar' ? 'Nada a pagar' : 'Nenhuma comissão paga'}
              description={statusTab === 'apagar' ? 'Não há comissões pendentes neste período.' : 'Nenhuma comissão foi repassada neste período.'}
            />
          ) : (
            <>
              {/* Tabela — desktop */}
              <div className="bg-surface border border-line rounded-[14px] overflow-hidden hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface-2">
                      <th className="text-left px-5 py-3.5 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">Data agend.</th>
                      <th className="text-left px-5 py-3.5 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">Data pgto.</th>
                      <th className="text-left px-5 py-3.5 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">Cliente</th>
                      <th className="text-left px-5 py-3.5 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">Serviço</th>
                      <th className="text-right px-5 py-3.5 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">Valor do serviço</th>
                      <th className="text-right px-5 py-3.5 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">Sua comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaAtual.map(row => (
                      <tr key={row.uuid} className="border-b border-line-2 last:border-0 hover:bg-surface-2 transition-colors">
                        <td className="px-5 py-4 font-mono text-[12px] text-ink-3">{formatDate(row.appointment_date)}</td>
                        <td className="px-5 py-4 font-mono text-[12px] text-ink-4">{formatDate(row.data)}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Avatar name={row.cliente} index={0} size="sm" />
                            <span className="font-medium text-[13.5px] text-ink">{row.cliente}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[13px] text-ink-2">
                          {row.servico}
                          {row.papel === 'assistente' && (
                            <span className="ml-1.5 inline-flex items-center px-1.5 py-[1px] rounded-full text-[10px] font-medium bg-surface-3 text-ink-3 align-middle">
                              Assistente
                            </span>
                          )}
                          {row.via_pacote && (
                            <span className="ml-1.5 inline-flex items-center px-1.5 py-[1px] rounded-full text-[10px] font-medium bg-brand-soft text-brand align-middle">
                              Via pacote
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-[12.5px] text-ink-2">
                          {row.via_pacote ? <span className="text-ink-4">Pago no pacote</span> : formatCurrency(row.gross_amount)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="font-mono text-[13px] font-semibold text-brand"><MoneyValue>{formatCurrency(row.commission_amount)}</MoneyValue></span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-line bg-surface-2">
                      <td colSpan={4} className="px-5 py-3.5 font-mono text-[11px] uppercase tracking-widest text-ink-3">
                        Total · {listaAtual.length} atendimento{listaAtual.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-[12.5px] font-semibold text-ink"><MoneyValue>{formatCurrency(totalServicoAtual)}</MoneyValue></td>
                      <td className="px-5 py-3.5 text-right font-mono text-[13px] font-semibold text-brand"><MoneyValue>{formatCurrency(totalComissaoAtual)}</MoneyValue></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Cards — mobile */}
              <div className="md:hidden space-y-3">
                {listaAtual.map(row => (
                  <div key={row.uuid} className="bg-surface border border-line rounded-[14px] px-4 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={row.cliente} index={0} size="sm" />
                        <span className="font-medium text-[14px] text-ink">{row.cliente}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-[11px] text-ink-3">Agend. {formatDate(row.appointment_date)}</div>
                        <div className="font-mono text-[10px] text-ink-4">Pgto. {formatDate(row.data)}</div>
                      </div>
                    </div>
                    <div className="text-[13px] text-ink-2 mb-3">
                      {row.servico}
                      {row.papel === 'assistente' && (
                        <span className="ml-1.5 inline-flex items-center px-1.5 py-[1px] rounded-full text-[10px] font-medium bg-surface-3 text-ink-3 align-middle">
                          Assistente
                        </span>
                      )}
                      {row.via_pacote && (
                        <span className="ml-1.5 inline-flex items-center px-1.5 py-[1px] rounded-full text-[10px] font-medium bg-brand-soft text-brand align-middle">
                          Via pacote
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-line-2">
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-ink-4 mb-0.5">Valor do serviço</div>
                        <div className="font-mono text-[13px] text-ink-2">
                          {row.via_pacote ? <span className="text-ink-4">Pago no pacote</span> : formatCurrency(row.gross_amount)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-[10px] uppercase tracking-widest text-ink-4 mb-0.5">Sua comissão</div>
                        <div className="font-mono text-[14px] font-semibold text-brand"><MoneyValue>{formatCurrency(row.commission_amount)}</MoneyValue></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </AppLayout>
  )
}
