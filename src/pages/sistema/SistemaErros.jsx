import { useEffect, useState } from 'react'
import platformApi from '@/lib/platformApi'
import { formatDateTime } from '@/lib/format'
import PaginationControls from '@/components/ui/PaginationControls'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icons'
import { useToast } from '@/context/ToastContext'
import { useSystemWrite, errorOf } from './systemContext'
import { OriginBadge, Badge, selectCls, SkeletonRows, SidePanel, Card, Panel, SearchField, Toolbar, LoadError, TONES } from './shared'

// Erros do sistema (backend e frontend), guardados por 14 dias. Erros iguais dentro de 1h aparecem numa linha só.
const LIMIT = 30
const ORIGINS = [
  { id: '', label: 'Front e back' },
  { id: 'backend', label: 'Backend' },
  { id: 'frontend', label: 'Frontend' },
]
const PERIODS = [{ days: 1, label: 'Últimas 24h' }, { days: 7, label: 'Últimos 7 dias' }, { days: 14, label: 'Últimos 14 dias' }]
const SOURCE_LABEL = {
  http: 'Requisição', job: 'Rotina agendada', process: 'Processo',
  external: 'Serviço externo', billing: 'Pagamento a conferir',
  render: 'Tela quebrou', window: 'Erro de script', promise: 'Promessa sem tratamento',
}

const where = (e) => [e.method, e.path].filter(Boolean).join(' ') || e.context || '—'

// Texto para colar numa conversa com o Claude Code: o que aconteceu, onde e o stack
function errorReport(e) {
  const lines = [
    'Erro registrado no painel /sistema do Dauth. Encontre a causa no código e corrija.',
    '',
    `Mensagem: ${e.message}`,
    `Origem: ${e.origin === 'frontend' ? 'frontend' : 'backend'} (${SOURCE_LABEL[e.source] ?? e.source})`,
    `Onde: ${where(e)}`,
    e.context && `Contexto: ${e.context}`,
    e.status && `Status HTTP: ${e.status}`,
    e.salonSlug && `Salão: /${e.salonSlug}`,
    `Ocorrências: ${e.occurrences} (primeira ${formatDateTime(e.createdAt)}, última ${formatDateTime(e.lastSeenAt)})`,
    e.userAgent && `Navegador: ${e.userAgent}`,
  ].filter(Boolean)
  if (e.stack) lines.push('', 'Stack:', '```', e.stack, '```')
  return lines.join('\n')
}

export default function SistemaErros({ salonId, onClearSalon }) {
  const [filters, setFilters] = useState({ origin: '', days: 14, search: '' })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [failed, setFailed] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => { setFilters(f => ({ ...f, search })); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [salonId])

  useEffect(() => {
    let alive = true
    setResult(null)
    setFailed(false)
    const params = { page, limit: LIMIT, days: filters.days }
    if (filters.origin) params.origin = filters.origin
    if (filters.search) params.search = filters.search
    if (salonId) params.salonId = salonId
    platformApi.get('/system/errors', { params })
      .then(r => { if (alive) setResult(r.data) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [filters, page, salonId, reloadKey])

  const setFilter = (key, parse = v => v) => (e) => { setFilters(f => ({ ...f, [key]: parse(e.target.value) })); setPage(1) }
  const selectFull = `${selectCls} flex-1 sm:flex-none`

  return (
    <Card className="overflow-hidden">
      <Toolbar>
        <SearchField value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar mensagem ou rota" label="Buscar erro" />
        <select value={filters.origin} onChange={setFilter('origin')} aria-label="Origem" className={selectFull}>
          {ORIGINS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <select value={filters.days} onChange={setFilter('days', Number)} aria-label="Período" className={selectFull}>
          {PERIODS.map(p => <option key={p.days} value={p.days}>{p.label}</option>)}
        </select>
      </Toolbar>

      {salonId && (
        <div className="px-4 py-2.5 bg-brand-soft/60 border-b border-line flex items-center justify-between gap-3 text-[12.5px]">
          <span className="text-brand-soft-ink">Mostrando só os erros de um salão.</span>
          <button onClick={onClearSalon} className="text-brand font-medium hover:underline cursor-pointer">Ver de todos</button>
        </div>
      )}

      {failed ? <LoadError>Não foi possível carregar os erros.</LoadError>
        : !result ? <SkeletonRows />
        : result.data.length === 0 ? <EmptyState icon="check" title="Nenhum erro no período" />
        : (
          <>
            <div className="divide-y divide-line">
              {result.data.map(e => (
                <button key={e.id} onClick={() => setOpenId(e.id)}
                  className="relative w-full text-left pl-5 pr-4 py-3.5 hover:bg-surface-2/70 cursor-pointer block transition-colors">
                  <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${e.origin === 'frontend' ? 'bg-brand' : 'bg-danger'}`} />
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 mb-1.5">
                    <OriginBadge origin={e.origin} />
                    {e.status && <span className="font-mono text-[11px] font-medium text-danger">{e.status}</span>}
                    {e.occurrences > 1 && <Badge dot={false}>{e.occurrences}x</Badge>}
                    {e.salonName && <span className="text-[11.5px] text-ink-3">{e.salonName}</span>}
                    <span className="ml-auto text-[11px] text-ink-3">{formatDateTime(e.lastSeenAt)}</span>
                  </div>
                  <p className="text-[13.5px] text-ink font-medium break-words line-clamp-2">{e.message}</p>
                  <p className="font-mono text-[11px] text-ink-3 mt-1 truncate">{where(e)}</p>
                </button>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-line bg-surface-2/50">
              <span className="text-[12px] text-ink-3">{result.total} erro(s) diferente(s)</span>
              <PaginationControls page={page} totalPages={Math.ceil(result.total / LIMIT)} onChange={setPage} />
            </div>
          </>
        )}

      {openId && <ErrorDetail id={openId} onClose={() => setOpenId(null)} onResolved={() => { setOpenId(null); setReloadKey(k => k + 1) }} />}
    </Card>
  )
}

function ErrorDetail({ id, onClose, onResolved }) {
  const write = useSystemWrite()
  const [e, setE] = useState(null)
  const [failed, setFailed] = useState(false)
  const [resolving, setResolving] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    platformApi.get(`/system/errors/${id}`).then(r => setE(r.data)).catch(() => setFailed(true))
  }, [id])

  const rows = e && [
    ['Tipo', SOURCE_LABEL[e.source] ?? e.source],
    ['Onde', where(e)],
    ['Contexto', e.context],
    ['Status HTTP', e.status],
    ['Salão', e.salonName ? `${e.salonName} (/${e.salonSlug})` : e.salonId],
    ['Usuário (id)', e.userId],
    ['Ocorrências', e.occurrences],
    ['Primeira vez', formatDateTime(e.createdAt)],
    ['Última vez', formatDateTime(e.lastSeenAt)],
    ['Navegador', e.userAgent],
  ].filter(([, v]) => v != null && v !== '')

  // "Ajustado": o erro (e os iguais) some da lista; se acontecer de novo, volta como erro novo
  async function resolve() {
    setResolving(true)
    try {
      await write('post', `/system/errors/${id}/resolve`)
      addToast('Erro marcado como ajustado e removido da lista.', 'success')
      onResolved()
    } catch (err) {
      if (!err.cancelled) addToast(`Falha: ${errorOf(err, 'Não foi possível marcar como ajustado.')}`, 'error')
      setResolving(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(errorReport(e))
      addToast('Erro copiado. Cole na conversa com o Claude para corrigir.', 'success')
    } catch {
      addToast('Não foi possível copiar. Selecione o texto e copie manualmente.', 'error')
    }
  }

  return (
    <SidePanel title="Detalhe do erro" onClose={onClose}
      leading={<span className={`w-11 h-11 rounded-lg grid place-items-center shrink-0 ${TONES.danger.soft}`}><Icon name="alertTriangle" size={20} /></span>}
      meta={e && <OriginBadge origin={e.origin} />}>
      {failed ? <LoadError>Não foi possível carregar o erro.</LoadError>
        : !e ? <SkeletonRows rows={4} />
        : (
          <>
            <Card className="p-4">
              <p className="text-[14px] text-ink font-medium break-words leading-relaxed">{e.message}</p>
              <div className="mt-3.5 flex flex-wrap gap-2">
                <Button size="sm" onClick={resolve} loading={resolving}><Icon name="check" size={14} />Ajustado</Button>
                <Button variant="outline" size="sm" onClick={copy} disabled={resolving}>Copiar erro</Button>
              </div>
              <p className="text-[11.5px] text-ink-3 mt-2.5">Ajustado remove este erro da lista. Se voltar a acontecer, aparece de novo.</p>
            </Card>

            <Panel title="Informações">
              <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-3 text-[12.5px]">
                {rows.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-ink-3">{label}</dt>
                    <dd className="text-ink-2 break-all">{value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>

            {e.stack && (
              <Panel title="Stack" flush>
                <pre className="text-[11px] leading-relaxed font-mono text-ink-2 bg-surface-2 p-4 overflow-x-auto whitespace-pre">{e.stack}</pre>
              </Panel>
            )}
          </>
        )}
    </SidePanel>
  )
}
