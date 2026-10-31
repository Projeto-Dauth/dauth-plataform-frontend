import { useEffect, useState } from 'react'
import platformApi from '@/lib/platformApi'
import { formatDateTime } from '@/lib/format'
import PaginationControls from '@/components/ui/PaginationControls'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import { useToast } from '@/context/ToastContext'
import { OriginBadge, selectCls, SkeletonRows, SidePanel } from './shared'

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
  }, [filters, page, salonId])

  const setFilter = (key, parse = v => v) => (e) => { setFilters(f => ({ ...f, [key]: parse(e.target.value) })); setPage(1) }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar mensagem ou rota"
          aria-label="Buscar erro" className={`${selectCls} flex-1 min-w-[200px]`} />
        <select value={filters.origin} onChange={setFilter('origin')} aria-label="Origem" className={selectCls}>
          {ORIGINS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <select value={filters.days} onChange={setFilter('days', Number)} aria-label="Período" className={selectCls}>
          {PERIODS.map(p => <option key={p.days} value={p.days}>{p.label}</option>)}
        </select>
      </div>

      {salonId && (
        <div className="mb-4 flex items-center gap-2 text-[12.5px]">
          <span className="text-ink-2">Mostrando só os erros de um salão.</span>
          <button onClick={onClearSalon} className="text-brand underline cursor-pointer">Ver de todos</button>
        </div>
      )}

      {failed ? <p className="text-sm text-danger">Não foi possível carregar os erros.</p>
        : !result ? <SkeletonRows />
        : result.data.length === 0 ? <EmptyState icon="check" title="Nenhum erro no período" />
        : (
          <>
            <p className="text-[11.5px] text-ink-3 mb-2">{result.total} erro(s) diferente(s)</p>
            <div className="rounded-lg border border-line bg-surface divide-y divide-line">
              {result.data.map(e => (
                <button key={e.id} onClick={() => setOpenId(e.id)}
                  className="w-full text-left px-4 py-3 hover:bg-surface-2 cursor-pointer block">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <OriginBadge origin={e.origin} />
                    {e.status && <span className="font-mono text-[11px] text-danger">{e.status}</span>}
                    <span className="text-[11px] text-ink-3">{formatDateTime(e.lastSeenAt)}</span>
                    {e.occurrences > 1 && <span className="text-[11px] text-ink-2 font-medium">{e.occurrences}x</span>}
                    {e.salonName && <span className="text-[11px] text-ink-3">· {e.salonName}</span>}
                  </div>
                  <p className="text-[13px] text-ink break-words line-clamp-2">{e.message}</p>
                  <p className="font-mono text-[11px] text-ink-3 mt-0.5 truncate">{where(e)}</p>
                </button>
              ))}
            </div>
            <PaginationControls page={page} totalPages={Math.ceil(result.total / LIMIT)} onChange={setPage} />
          </>
        )}

      {openId && <ErrorDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function ErrorDetail({ id, onClose }) {
  const [e, setE] = useState(null)
  const [failed, setFailed] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    platformApi.get(`/system/errors/${id}`).then(r => setE(r.data)).catch(() => setFailed(true))
  }, [id])

  const rows = e && [
    ['Origem', <OriginBadge key="o" origin={e.origin} />],
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

  async function copy() {
    try {
      await navigator.clipboard.writeText(errorReport(e))
      addToast('Erro copiado. Cole na conversa com o Claude para corrigir.', 'success')
    } catch {
      addToast('Não foi possível copiar. Selecione o texto e copie manualmente.', 'error')
    }
  }

  return (
    <SidePanel title="Detalhe do erro" onClose={onClose}>
      {failed ? <p className="text-sm text-danger">Não foi possível carregar o erro.</p>
        : !e ? <SkeletonRows rows={4} />
        : (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[14px] text-ink font-medium break-words">{e.message}</p>
              <Button variant="ghost" size="sm" onClick={copy} className="shrink-0">Copiar erro</Button>
            </div>
            <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 text-[12.5px]">
              {rows.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-ink-3">{label}</dt>
                  <dd className="text-ink-2 break-all">{value}</dd>
                </div>
              ))}
            </dl>
            {e.stack && (
              <div>
                <p className="eyebrow mb-2">Stack</p>
                <pre className="text-[11px] leading-relaxed font-mono text-ink-2 bg-surface-2 border border-line rounded-md p-3 overflow-x-auto whitespace-pre">{e.stack}</pre>
              </div>
            )}
          </div>
        )}
    </SidePanel>
  )
}
