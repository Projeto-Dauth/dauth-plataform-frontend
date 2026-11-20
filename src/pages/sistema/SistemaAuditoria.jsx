import { useEffect, useState } from 'react'
import platformApi from '@/lib/platformApi'
import { formatDateTime } from '@/lib/format'
import Icon from '@/components/ui/Icons'
import PaginationControls from '@/components/ui/PaginationControls'
import EmptyState from '@/components/ui/EmptyState'
import { Card, SkeletonRows, LoadError, TONES } from './shared'

const LIMIT = 25

const ACTIONS = {
  'error.resolve': 'Erro ajustado',
  'salon.edit': 'Dados editados',
  'salon.plan': 'Plano definido',
  'salon.trial': 'Trial estendido',
  'salon.suspend': 'Salão suspenso',
  'salon.reactivate': 'Salão reativado',
  'salon.archive': 'Salão arquivado',
  'salon.unarchive': 'Salão desarquivado',
  'salon.schedule_deletion': 'Exclusão agendada',
  'salon.cancel_deletion': 'Exclusão cancelada',
  'salon.waitlist_discount': 'Desconto da lista de espera',
  'user.revoke_sessions': 'Sessões encerradas',
  'user.password_reset': 'Link de nova senha enviado',
  'user.block': 'Conta bloqueada',
  'user.unblock': 'Conta desbloqueada',
  'user.anonymize': 'Conta anonimizada',
  'mfa.enroll': 'MFA cadastrado',
  'mfa.unlock': 'Painel destravado',
  'mfa.recovery_used': 'Código de recuperação usado',
  'mfa.locked': 'MFA bloqueado por tentativas',
}

// Ícone pelo tipo (salão, usuário, segurança) e cor pela gravidade da ação
const KIND_ICON = { error: 'alertTriangle', salon: 'store', user: 'users', mfa: 'shield' }
const DANGER = ['salon.suspend', 'salon.schedule_deletion', 'user.block', 'user.anonymize', 'mfa.locked']
const POSITIVE = ['error.resolve', 'salon.reactivate', 'salon.unarchive', 'salon.cancel_deletion', 'user.unblock', 'mfa.unlock', 'mfa.enroll']
const toneOf = (action) => (DANGER.includes(action) ? 'danger' : POSITIVE.includes(action) ? 'success' : action.startsWith('mfa.') ? 'warning' : 'brand')

const FIELDS = {
  name: 'Nome', phone: 'Telefone', address: 'Endereço', description: 'Descrição', timezone: 'Fuso', status: 'Situação', plan: 'Plano',
  billingMonths: 'Meses', trialEndsAt: 'Fim do trial', planEndsAt: 'Vencimento', cancelAtPeriodEnd: 'Cancela no fim', renewalNoticeFor: 'Aviso de renovação',
  archivedAt: 'Arquivado em', scheduledDeletionAt: 'Exclusão em', active: 'Ativo',
  sessions: 'Sessões abertas', linkSent: 'Link enviado', state: 'Situação da conta',
}

const ISO = /^\d{4}-\d{2}-\d{2}T/
const show = (v) => (v === null || v === undefined || v === '' ? '—' : ISO.test(v) ? formatDateTime(v) : typeof v === 'boolean' ? (v ? 'sim' : 'não') : String(v))

// "Plano: essencial → business"
function Changes({ before, after }) {
  const keys = Object.keys(after ?? before ?? {})
  if (!keys.length) return null
  return (
    <ul className="mt-2.5 flex flex-wrap gap-1.5">
      {keys.map(k => (
        <li key={k} className="rounded-md bg-surface-2 border border-line-2 px-2 py-1 text-[11.5px] text-ink-3">
          {FIELDS[k] ?? k}: <span className="text-ink-2">{show(before?.[k])}</span> → <span className="text-ink font-medium">{show(after?.[k])}</span>
        </li>
      ))}
    </ul>
  )
}

// Quem fez o quê, quando e por quê. Só leitura: a trilha não pode ser alterada nem apagada por aqui.
export default function SistemaAuditoria() {
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setResult(null)
    setFailed(false)
    platformApi.get('/system/audit', { params: { page, limit: LIMIT } })
      .then(r => { if (alive) setResult(r.data) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [page])

  return (
    <Card className="overflow-hidden">
      {failed ? <LoadError>Não foi possível carregar a auditoria.</LoadError>
        : !result ? <SkeletonRows />
        : result.data.length === 0 ? <EmptyState icon="search" title="Nenhuma ação registrada" />
        : (
          <>
            <div className="divide-y divide-line">
              {result.data.map(r => (
                <div key={r.id} className="flex gap-3.5 px-5 py-4">
                  <span className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${TONES[toneOf(r.action)].soft}`}>
                    <Icon name={KIND_ICON[r.action.split('.')[0]] ?? 'shield'} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <span className="text-[13.5px] text-ink font-medium">{ACTIONS[r.action] ?? r.action}{r.salonName ? ` · ${r.salonName}` : ''}{r.targetUserName ? ` · ${r.targetUserName}` : ''}</span>
                      <span className="text-[11.5px] text-ink-3">{formatDateTime(r.createdAt)}</span>
                    </div>
                    {r.reason && <p className="text-[13px] text-ink-2 mt-1 leading-relaxed">{r.reason}</p>}
                    <Changes before={r.before} after={r.after} />
                    <p className="text-[11.5px] text-ink-3 mt-2.5">por {r.userName ?? 'conta removida'}{r.ip ? ` · ${r.ip}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-line bg-surface-2/50">
              <span className="text-[12px] text-ink-3">{result.total} registro(s)</span>
              <PaginationControls page={page} totalPages={Math.ceil(result.total / LIMIT)} onChange={setPage} />
            </div>
          </>
        )}
    </Card>
  )
}
