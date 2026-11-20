import { useEffect, useState } from 'react'
import platformApi from '@/lib/platformApi'
import { formatDate, formatDateTime } from '@/lib/format'
import PaginationControls from '@/components/ui/PaginationControls'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Icon from '@/components/ui/Icons'
import ActionDialog from './ActionDialog'
import {
  SituationBadge, selectCls, SkeletonRows, SidePanel, Card, Panel, Badge, Field, MiniStat, InitialAvatar, SearchField, Toolbar, LoadError, thCls, tdCls,
} from './shared'

// Aba Usuários: donos de salão, profissionais e clientes. Uma conta (User) pode estar em vários salões, com papéis diferentes.
const LIMIT = 25
const ROLE_LABEL = { Admin: 'Dono', Profissional: 'Profissional', Servico: 'Conta de serviço', Usuario: 'Cliente' }
const ROLE_OPTIONS = Object.entries(ROLE_LABEL).map(([id, label]) => ({ id, label }))
const STATES = {
  active:     { label: 'Ativa',       tone: 'success' },
  blocked:    { label: 'Bloqueada',   tone: 'danger' },
  pending:    { label: 'Pendente',    tone: 'warning' },
  anonymized: { label: 'Anonimizada', tone: 'neutral' },
}

function StateBadge({ state }) {
  const s = STATES[state] ?? { label: state, tone: 'neutral' }
  return <Badge tone={s.tone}>{s.label}</Badge>
}

// "Dono · Salão A, Profissional · Salão B" (até 2; o resto vira "+n")
function salonsSummary(salons) {
  if (!salons.length) return 'Sem salão'
  const shown = salons.slice(0, 2).map(s => `${ROLE_LABEL[s.role] ?? s.role} · ${s.name}`).join(', ')
  return salons.length > 2 ? `${shown} +${salons.length - 2}` : shown
}

const contactOf = (u) => [u.phone, u.email].filter(Boolean).join(' · ') || 'Sem contato'
const sessionsLabel = (n) => (n > 0 ? `${n} ${n === 1 ? 'sessão' : 'sessões'}` : '—')

export default function SistemaUsuarios() {
  const [filters, setFilters] = useState({ search: '', role: '', state: '' })
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

  useEffect(() => {
    let alive = true
    setResult(null)
    setFailed(false)
    const params = { page, limit: LIMIT }
    for (const k of ['search', 'role', 'state']) if (filters[k]) params[k] = filters[k]
    platformApi.get('/system/users', { params })
      .then(r => { if (alive) setResult(r.data) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [filters, page, reloadKey])

  const setFilter = (key) => (e) => { setFilters(f => ({ ...f, [key]: e.target.value })); setPage(1) }
  const selectFull = `${selectCls} flex-1 sm:flex-none`

  return (
    <Card className="overflow-hidden">
      <Toolbar>
        <SearchField value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, email ou telefone" label="Buscar usuário" />
        <select value={filters.role} onChange={setFilter('role')} aria-label="Papel" className={selectFull}>
          <option value="">Todos os papéis</option>
          {ROLE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <select value={filters.state} onChange={setFilter('state')} aria-label="Situação da conta" className={selectFull}>
          <option value="">Todas as situações</option>
          {Object.entries(STATES).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
        </select>
      </Toolbar>

      {failed ? <LoadError>Não foi possível carregar os usuários.</LoadError>
        : !result ? <SkeletonRows />
        : result.data.length === 0 ? <EmptyState icon="search" title="Nenhum usuário encontrado" />
        : (
          <>
            {/* Computador: tabela */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr>
                    <th className={thCls}>Usuário</th>
                    <th className={thCls}>Salões e papéis</th>
                    <th className={thCls}>Sessões</th>
                    <th className={thCls}>Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {result.data.map(u => (
                    <tr key={u.id} onClick={() => setOpenId(u.id)} className="hover:bg-surface-2/70 cursor-pointer transition-colors">
                      <td className={tdCls}>
                        <button className="flex items-center gap-3 text-left cursor-pointer" aria-label={`Ver ${u.name}`}>
                          <InitialAvatar name={u.name} />
                          <span className="min-w-0">
                            <span className="block text-ink font-medium truncate max-w-[260px]">{u.name}</span>
                            <span className="block text-[11.5px] text-ink-3 truncate max-w-[260px]">{contactOf(u)}</span>
                          </span>
                        </button>
                      </td>
                      <td className={`${tdCls} text-ink-2 max-w-[300px]`}><span className="block truncate">{salonsSummary(u.salons)}</span></td>
                      <td className={`${tdCls} text-ink-3`}>{sessionsLabel(u.sessions)}</td>
                      <td className={tdCls}><StateBadge state={u.state} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Celular: cartões */}
            <div className="md:hidden divide-y divide-line">
              {result.data.map(u => (
                <button key={u.id} onClick={() => setOpenId(u.id)} aria-label={`Ver ${u.name}`} className="w-full text-left p-4 cursor-pointer active:bg-surface-2">
                  <div className="flex items-start gap-3">
                    <InitialAvatar name={u.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm text-ink font-medium">{u.name}</span>
                        <StateBadge state={u.state} />
                      </div>
                      <p className="text-[12px] text-ink-3 mt-0.5 truncate">{contactOf(u)}</p>
                      <p className="text-[12px] text-ink-2 mt-1 truncate">{salonsSummary(u.salons)}</p>
                      {u.sessions > 0 && <p className="text-[11.5px] text-ink-3 mt-1">{sessionsLabel(u.sessions)}</p>}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-line bg-surface-2/50">
              <div className="flex items-center justify-between gap-3 text-[12px] text-ink-3">
                <span>{result.total} usuário(s)</span>
                <span className="hidden sm:inline">Clique em uma linha para ver o detalhe e as ações</span>
              </div>
              <PaginationControls page={page} totalPages={Math.ceil(result.total / LIMIT)} onChange={setPage} />
            </div>
          </>
        )}

      {openId && <UserDetail id={openId} onClose={() => setOpenId(null)} onChanged={() => setReloadKey(k => k + 1)} />}
    </Card>
  )
}

function UserDetail({ id, onClose, onChanged }) {
  const [u, setU] = useState(null)
  const [failed, setFailed] = useState(false)
  const load = () => platformApi.get(`/system/users/${id}`).then(r => setU(r.data)).catch(() => setFailed(true))
  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  const changed = () => { load(); onChanged() }

  return (
    <SidePanel title={u?.name ?? 'Usuário'} onClose={onClose}
      leading={u && <InitialAvatar name={u.name} size="lg" />}
      meta={u && <StateBadge state={u.state} />}>
      {failed ? <LoadError>Não foi possível carregar o usuário.</LoadError>
        : !u ? <SkeletonRows rows={5} />
        : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Salões" value={u.salons.length} />
              <MiniStat label="Sessões abertas" value={u.sessions.length} />
            </div>

            {u.protected
              ? (
                <Card className="p-4 flex items-start gap-3">
                  <span className="w-9 h-9 rounded-lg grid place-items-center shrink-0 bg-brand-soft text-brand-soft-ink"><Icon name="shield" size={17} /></span>
                  <p className="text-[13px] text-ink-2 leading-relaxed pt-1">Conta dona do painel: não pode ser alterada por aqui.</p>
                </Card>
              )
              : <UserActions user={u} onChanged={changed} />}

            <Panel title="Dados da conta">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                <Field label="Telefone (login)">{u.phone}</Field>
                <Field label="Email">{u.email}</Field>
                <Field label="Cadastro">{formatDate(u.createdAt)}</Field>
              </dl>
            </Panel>

            <Panel title="Salões" flush>
              {u.salons.length === 0 ? <p className="px-5 py-5 text-sm text-ink-3">Não participa de nenhum salão.</p> : (
                <div className="divide-y divide-line">
                  {u.salons.map(s => (
                    <div key={`${s.id}-${s.role}`} className="px-5 py-3 flex items-center justify-between gap-3 text-[12.5px]">
                      <div className="flex items-center gap-3 min-w-0">
                        <InitialAvatar name={s.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-ink font-medium truncate">{s.name}</p>
                          <p className="text-[11px] text-ink-3">{ROLE_LABEL[s.role] ?? s.role}{s.memberActive ? '' : ' · vínculo inativo'}</p>
                        </div>
                      </div>
                      <SituationBadge situation={s.scheduledDeletionAt ? 'deleting' : s.archivedAt ? 'archived' : s.status} />
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Sessões abertas" flush>
              {u.sessions.length === 0 ? <p className="px-5 py-5 text-sm text-ink-3">Nenhuma sessão aberta.</p> : (
                <div className="divide-y divide-line">
                  {u.sessions.map(s => (
                    <div key={s.id} className="px-5 py-3 flex items-start gap-3 text-[12.5px]">
                      <span className="w-8 h-8 rounded-md bg-surface-2 border border-line-2 grid place-items-center text-ink-3 shrink-0"><Icon name="eye" size={14} /></span>
                      <div className="min-w-0">
                        <p className="text-ink truncate">{s.userAgent ?? 'Aparelho desconhecido'}</p>
                        <p className="text-[11px] text-ink-3 mt-0.5">{s.ipAddress ?? 'IP desconhecido'} · última atividade {formatDateTime(s.updatedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </>
        )}
    </SidePanel>
  )
}

const SIMPLE = {
  revoke: { title: 'Encerrar sessões', confirmLabel: 'Encerrar sessões', success: 'Sessões encerradas com sucesso.', icon: 'logout', path: '/revoke-sessions', description: 'Apaga todos os logins da pessoa. Quem está com a tela aberta pode levar até 5 min para cair. Ela pode entrar de novo com a senha.' },
  reset: { title: 'Enviar link de nova senha', confirmLabel: 'Enviar link', success: 'Link de nova senha enviado por WhatsApp.', icon: 'phone', path: '/password-reset', description: 'Manda o link de redefinição (vale 1 h) no WhatsApp cadastrado. A senha não passa por aqui.' },
  block: { title: 'Bloquear conta', confirmLabel: 'Bloquear', success: 'Conta bloqueada com sucesso.', danger: true, icon: 'ban', path: '/block', description: 'Impede novos logins em todos os salões e apaga as sessões. Quem está com a tela aberta pode levar até 5 min para cair. Dá para desbloquear depois.' },
  unblock: { title: 'Desbloquear conta', confirmLabel: 'Desbloquear', success: 'Conta desbloqueada com sucesso.', icon: 'check', path: '/unblock', description: 'A pessoa volta a poder entrar com a senha de sempre.' },
}
const ICONS = { revoke: 'logout', reset: 'phone', unblock: 'check', block: 'ban', anonymize: 'eyeOff' }
const RISKY = ['block', 'anonymize'] // ficam separados dos demais, numa "zona de risco"

function AnonymizeDialog({ user, ...rest }) {
  const [confirm, setConfirm] = useState('')
  const hint = user.phone ?? user.email
  return (
    <ActionDialog url={`/system/users/${user.id}/anonymize`} title="Anonimizar conta" confirmLabel="Anonimizar" success="Conta anonimizada com sucesso." danger icon="eyeOff"
      description="Apaga nome, telefone, email e nascimento e bloqueia o login, mantendo o histórico financeiro sem identificar a pessoa. Não dá para desfazer. Não vale para dono de salão ativo."
      valid={confirm.trim().length > 0} getBody={() => ({ confirm })} {...rest}>
      <Input label={`Digite ${hint} para confirmar`} value={confirm} onChange={e => setConfirm(e.target.value)} className="!mb-0" autoComplete="off" />
    </ActionDialog>
  )
}

function UserActions({ user, onChanged }) {
  const [open, setOpen] = useState(null)
  const close = () => setOpen(null)
  const done = () => { close(); onChanged() }

  const buttons = []
  if (user.sessions.length) buttons.push(['revoke', 'Encerrar sessões'])
  if (user.state === 'active') buttons.push(['reset', 'Enviar link de senha'], ['block', 'Bloquear'])
  if (user.state === 'blocked') buttons.push(['unblock', 'Desbloquear'])
  if (user.state !== 'anonymized') buttons.push(['anonymize', 'Anonimizar'])
  if (!buttons.length) return null

  const safe = buttons.filter(([id]) => !RISKY.includes(id))
  const risky = buttons.filter(([id]) => RISKY.includes(id))
  const renderButton = ([id, label]) => (
    <Button key={id} variant="outline" size="sm" onClick={() => setOpen(id)} className={RISKY.includes(id) ? '!text-danger !border-danger/30 hover:!bg-danger-soft' : ''}>
      <Icon name={ICONS[id]} size={14} />{label}
    </Button>
  )

  return (
    <Panel title="Ações">
      {safe.length > 0 && <div className="flex flex-wrap gap-2">{safe.map(renderButton)}</div>}
      {risky.length > 0 && (
        <div className={`rounded-lg border border-danger/25 bg-danger-soft/50 p-3 ${safe.length > 0 ? 'mt-4' : ''}`}>
          <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-danger mb-2.5"><Icon name="alertTriangle" size={13} />Zona de risco</p>
          <div className="flex flex-wrap gap-2">{risky.map(renderButton)}</div>
        </div>
      )}
      {open === 'anonymize' && <AnonymizeDialog user={user} onClose={close} onDone={done} />}
      {SIMPLE[open] && <ActionDialog url={`/system/users/${user.id}${SIMPLE[open].path}`} {...SIMPLE[open]} onClose={close} onDone={done} />}
    </Panel>
  )
}
