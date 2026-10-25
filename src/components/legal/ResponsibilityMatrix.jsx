const DAUTH = 'dauth'
const SALAO = 'salao'

// Fonte única da matriz. `who`: quem responde pelo item. Dois valores = responsabilidade compartilhada.
const GROUPS = [
  {
    title: 'Plataforma e infraestrutura',
    rows: [
      { text: 'Manter o sistema no ar: servidores, banco de dados e certificado HTTPS', who: [DAUTH] },
      { text: 'Atualizações, correções e novas funcionalidades', who: [DAUTH] },
      { text: 'Cópias de segurança do banco de dados', who: [DAUTH] },
      { text: 'Segurança da plataforma', who: [DAUTH], note: 'Sessão, senhas protegidas, isolamento entre salões e limite de tentativas de login.' },
      { text: 'Cálculos do sistema (comissões, pacotes, crédito, fuso horário)', who: [DAUTH], note: 'Se o cálculo estiver errado, o erro é nosso.' },
      { text: 'Internet, computador, celular e navegador atualizado', who: [SALAO] },
    ],
  },
  {
    title: 'Plano e pagamento',
    rows: [
      { text: 'Período de teste, cobrança e liberação do plano contratado', who: [DAUTH] },
      { text: 'Escolher o plano e pagar em dia', who: [SALAO], note: 'Sem pagamento o acesso é suspenso. Os dados ficam preservados.' },
      { text: 'Exclusão do salão', who: [DAUTH, SALAO], note: 'O administrador pede e pode cancelar em até 30 dias. Depois disso, os dados são apagados.' },
    ],
  },
  {
    title: 'Operação do salão',
    rows: [
      { text: 'Cadastrar serviços, preços, durações e categorias', who: [SALAO] },
      { text: 'Definir comissões de serviços, profissionais e pacotes', who: [SALAO], note: 'O sistema calcula, mas o percentual é decisão do salão.' },
      { text: 'Expediente, folgas e regras do agendamento online', who: [SALAO] },
      { text: 'Cadastrar profissionais, clientes e convites da equipe', who: [SALAO] },
      { text: 'Definir quem acessa cada área (Caixa, Comissões, etc.)', who: [SALAO] },
      { text: 'Remover o acesso de quem saiu da equipe', who: [SALAO] },
      { text: 'Guardar as senhas e não compartilhar logins', who: [SALAO] },
      { text: 'Conferir os valores lançados no Caixa', who: [SALAO] },
      { text: 'Pagar as comissões aos profissionais', who: [SALAO], note: 'O sistema apenas registra o repasse.' },
      { text: 'Recebimento dos clientes (maquininha, Pix, dinheiro)', who: [SALAO], note: 'O sistema registra o pagamento, mas não o processa.' },
    ],
  },
  {
    title: 'WhatsApp e e-mail',
    rows: [
      { text: 'Mensagens da plataforma: confirmar telefone, redefinir senha e convites', who: [DAUTH] },
      { text: 'Manter funcionando o serviço que envia as mensagens', who: [DAUTH] },
      { text: 'Ter um número de WhatsApp próprio e conectá-lo (planos com WhatsApp)', who: [SALAO] },
      { text: 'Conteúdo e frequência das mensagens enviadas aos clientes', who: [SALAO] },
      { text: 'Telefone do cliente correto e com WhatsApp ativo', who: [SALAO], note: 'O telefone é o login do cliente.' },
    ],
  },
  {
    title: 'Dados e LGPD',
    rows: [
      { text: 'Tratar os dados dos clientes do salão com base legal e transparência', who: [SALAO], note: 'O salão é o controlador dos dados dos seus clientes.' },
      { text: 'Tratar os dados somente para o funcionamento do serviço e protegê-los', who: [DAUTH], note: 'A Dauth atua como operadora desses dados.' },
      { text: 'Atender pedidos dos titulares (acesso, correção, exclusão)', who: [DAUTH, SALAO], note: 'O cliente fala com o salão. A Dauth dá o suporte técnico.' },
      { text: 'Comunicar incidente de segurança', who: [DAUTH, SALAO], note: 'A Dauth avisa o salão e o salão comunica seus clientes e a ANPD.' },
      { text: 'Não usar os dados para spam ou finalidade diferente da contratada', who: [SALAO] },
    ],
  },
  {
    title: 'Suporte',
    rows: [
      { text: 'Documentação e vídeos dentro da plataforma', who: [DAUTH] },
      { text: 'Atender chamados de suporte', who: [DAUTH] },
      { text: 'Treinar a equipe do salão no uso do sistema', who: [SALAO] },
      { text: 'Descrever o problema com clareza (tela, horário e o que foi feito)', who: [SALAO] },
    ],
  },
]

const LIMITS = [
  'A plataforma não emite nota fiscal. Obrigações fiscais e contábeis são do salão.',
  'A plataforma não processa pagamentos de clientes: ela registra o que o salão recebeu.',
  'Os horários do agendamento online dependem do expediente cadastrado pelo salão.',
]

const PARTY = {
  [DAUTH]: { label: 'Dauth', className: 'bg-brand text-white' },
  [SALAO]: { label: 'Salão', className: 'bg-gold text-ink' },
}

function Badge({ party }) {
  const { label, className } = PARTY[party]
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${className}`}>
      {label}
    </span>
  )
}

export default function ResponsibilityMatrix() {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5 text-[12px] text-ink-3">
        <span className="flex items-center gap-2"><Badge party={DAUTH} /> responsabilidade da Dauth</span>
        <span className="flex items-center gap-2"><Badge party={SALAO} /> responsabilidade do salão</span>
        <span>Os dois selos juntos indicam responsabilidade compartilhada.</span>
      </div>

      <div className="space-y-6">
        {GROUPS.map(group => (
          <section key={group.title} className="rounded-lg border border-line bg-surface overflow-hidden">
            <h3 className="px-4 py-2.5 text-[11px] font-mono uppercase tracking-widest text-ink-3 bg-surface-2 border-b border-line">
              {group.title}
            </h3>
            <ul className="divide-y divide-line-3">
              {group.rows.map(row => (
                <li key={row.text} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[14px] text-ink">{row.text}</p>
                    {row.note && <p className="text-[12px] text-ink-3 mt-0.5">{row.note}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:gap-1.5">
                    {row.who.map(party => <Badge key={party} party={party} />)}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-line bg-surface-2 px-4 py-3">
        <p className="text-[11px] font-mono uppercase tracking-widest text-ink-3 mb-2">O que a plataforma não faz</p>
        <ul className="list-disc pl-5 space-y-1 text-[13px] text-ink-2">
          {LIMITS.map(item => <li key={item}>{item}</li>)}
        </ul>
      </div>
    </div>
  )
}
