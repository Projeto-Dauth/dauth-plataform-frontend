import { useState } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { PLANS, BILLING_OPTIONS } from '@/config/plans'
import BaseActionDialog, { Labeled, textareaCls } from './ActionDialog'
import Icon from '@/components/ui/Icons'
import { selectCls, Panel } from './shared'

// Ações que ALTERAM um salão (painel /sistema). O diálogo comum (motivo + código recente) está em ActionDialog.jsx.
const TIMEZONES = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['America/Sao_Paulo']

// Aponta o diálogo comum para a rota do salão: `path` é o sufixo depois de /system/salons/:id
const ActionDialog = ({ salon, path, ...props }) => <BaseActionDialog url={`/system/salons/${salon.id}${path}`} {...props} />

function EditDialog({ salon, ...rest }) {
  const [f, setF] = useState({ name: salon.name, phone: salon.phone ?? '', address: salon.address ?? '', description: salon.description ?? '', timezone: salon.timezone })
  const set = (k) => (e) => setF(v => ({ ...v, [k]: e.target.value }))
  return (
    <ActionDialog salon={salon} title="Editar dados do salão" description="Muda só os dados gerais. O endereço (slug) não muda aqui, porque quebraria os links dos clientes."
      confirmLabel="Salvar" success="Dados do salão salvos com sucesso." method="patch" path="" valid={f.name.trim().length >= 2} getBody={() => f} {...rest}>
      <Input label="Nome" value={f.name} onChange={set('name')} maxLength={80} className="!mb-0" />
      <Input label="Telefone" value={f.phone} onChange={set('phone')} maxLength={30} className="!mb-0" />
      <Input label="Endereço" value={f.address} onChange={set('address')} maxLength={200} className="!mb-0" />
      <Labeled label="Descrição"><textarea value={f.description} onChange={set('description')} rows={3} maxLength={500} className={textareaCls} /></Labeled>
      <Labeled label="Fuso horário">
        <select value={f.timezone} onChange={set('timezone')} className={`${selectCls} h-[42px] w-full`}>
          {!TIMEZONES.includes(f.timezone) && <option value={f.timezone}>{f.timezone}</option>}
          {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
        </select>
      </Labeled>
    </ActionDialog>
  )
}

function PlanDialog({ salon, ...rest }) {
  const [plan, setPlan] = useState(salon.plan ?? 'essencial')
  const [months, setMonths] = useState(salon.billingMonths ?? 1)
  const [endsAt, setEndsAt] = useState('')
  return (
    <ActionDialog salon={salon} title="Definir plano" confirmLabel="Aplicar plano" success="Plano definido com sucesso." icon="card" path="/plan"
      description="Ativa o plano sem cobrança. Sem data, mantém o vencimento atual se o plano está em dia; senão conta a partir de hoje. Um PIX já gerado e pago depois disso aparece como duplicado para reembolsar."
      getBody={() => ({ plan, months, ...(endsAt ? { endsAt } : {}) })} {...rest}>
      <Labeled label="Plano">
        <select value={plan} onChange={e => setPlan(e.target.value)} className={`${selectCls} h-[42px] w-full`}>
          {PLANS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </Labeled>
      <Labeled label="Duração">
        <select value={months} onChange={e => setMonths(Number(e.target.value))} className={`${selectCls} h-[42px] w-full`}>
          {BILLING_OPTIONS.map(o => <option key={o.months} value={o.months}>{o.label}</option>)}
        </select>
      </Labeled>
      <Input label="Vencimento (opcional)" type="date" value={endsAt} onChange={e => setEndsAt(e.target.value)} className="!mb-0" />
    </ActionDialog>
  )
}

function TrialDialog({ salon, ...rest }) {
  const [days, setDays] = useState(7)
  return (
    <ActionDialog salon={salon} title="Estender trial" confirmLabel="Estender" success={`Trial estendido em ${days} dia(s).`} icon="clock" path="/trial"
      description="Soma os dias ao fim do trial. Se o trial já acabou, reabre a partir de hoje." valid={days >= 1 && days <= 60} getBody={() => ({ days })} {...rest}>
      <Input label="Dias (1 a 60)" type="number" min={1} max={60} value={days} onChange={e => setDays(Number(e.target.value))} className="!mb-0" />
    </ActionDialog>
  )
}

function DeleteDialog({ salon, ...rest }) {
  const [confirm, setConfirm] = useState('')
  return (
    <ActionDialog salon={salon} title="Agendar exclusão do salão" confirmLabel="Agendar exclusão" success="Exclusão agendada para daqui a 30 dias." danger icon="trash" path="/schedule-deletion"
      description="O salão some para todos agora e é apagado de vez em 30 dias, com clientes, agenda e caixa. Até lá dá para cancelar."
      valid={confirm === salon.slug} getBody={() => ({ confirm })} {...rest}>
      <Input label={`Digite ${salon.slug} para confirmar`} value={confirm} onChange={e => setConfirm(e.target.value)} className="!mb-0" autoComplete="off" />
    </ActionDialog>
  )
}

const ICONS = { edit: 'edit', plan: 'card', trial: 'clock', reactivate: 'check', suspend: 'ban', archive: 'archive', unarchive: 'archive', delete: 'trash', cancelDeletion: 'repeat' }
const RISKY = ['suspend', 'delete'] // ficam separados dos demais, numa "zona de risco"

const SIMPLE = {
  suspend: { title: 'Suspender salão', confirmLabel: 'Suspender', success: 'Salão suspenso com sucesso.', danger: true, icon: 'ban', path: '/suspend', description: 'O salão perde o acesso ao produto (cobrança 402) até ser reativado ou pagar.' },
  reactivate: { title: 'Reativar salão', confirmLabel: 'Reativar', success: 'Salão reativado com sucesso.', path: '/reactivate', description: 'Volta ao que o período ainda permite: ativo se o plano está em dia, trial se o trial não acabou.' },
  archive: { title: 'Arquivar salão', confirmLabel: 'Arquivar', success: 'Salão arquivado com sucesso.', path: '/archive', description: 'O salão fica oculto e bloqueado até ser desarquivado.' },
  unarchive: { title: 'Desarquivar salão', confirmLabel: 'Desarquivar', success: 'Salão desarquivado com sucesso.', path: '/unarchive', description: 'O salão volta a ser usado normalmente.' },
  cancelDeletion: { title: 'Cancelar exclusão', confirmLabel: 'Cancelar exclusão', success: 'Exclusão cancelada. O salão continua ativo.', path: '/cancel-deletion', description: 'O salão volta a ficar ativo e não será apagado.' },
}

// Botões conforme a situação do salão; `onChanged` recarrega o detalhe e a lista
export default function SalonActions({ salon, onChanged }) {
  const [open, setOpen] = useState(null)
  const close = () => setOpen(null)
  const done = () => { close(); onChanged() }
  const common = { salon, onClose: close, onDone: done }

  const deleting = Boolean(salon.scheduledDeletionAt)
  const trialEligible = salon.status === 'trial' || (salon.status === 'suspended' && !salon.endsAt)
  const buttons = deleting
    ? [['edit', 'Editar dados'], ['cancelDeletion', 'Cancelar exclusão']]
    : [
        ['edit', 'Editar dados'],
        ['plan', 'Definir plano'],
        ...(trialEligible ? [['trial', 'Estender trial']] : []),
        salon.status === 'suspended' ? ['reactivate', 'Reativar'] : ['suspend', 'Suspender'],
        salon.archivedAt ? ['unarchive', 'Desarquivar'] : ['archive', 'Arquivar'],
        ['delete', 'Agendar exclusão'],
      ]

  const safe = buttons.filter(([id]) => !RISKY.includes(id))
  const risky = buttons.filter(([id]) => RISKY.includes(id))
  const renderButton = ([id, label]) => (
    <Button key={id} variant="outline" size="sm" onClick={() => setOpen(id)} className={RISKY.includes(id) ? '!text-danger !border-danger/30 hover:!bg-danger-soft' : ''}>
      <Icon name={ICONS[id]} size={14} />{label}
    </Button>
  )

  return (
    <Panel title="Ações">
      <div className="flex flex-wrap gap-2">{safe.map(renderButton)}</div>
      {risky.length > 0 && (
        <div className="mt-4 rounded-lg border border-danger/25 bg-danger-soft/50 p-3">
          <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-danger mb-2.5"><Icon name="alertTriangle" size={13} />Zona de risco</p>
          <div className="flex flex-wrap gap-2">{risky.map(renderButton)}</div>
        </div>
      )}
      {open === 'edit' && <EditDialog {...common} />}
      {open === 'plan' && <PlanDialog {...common} />}
      {open === 'trial' && <TrialDialog {...common} />}
      {open === 'delete' && <DeleteDialog {...common} />}
      {SIMPLE[open] && <ActionDialog {...common} {...SIMPLE[open]} />}
    </Panel>
  )
}
