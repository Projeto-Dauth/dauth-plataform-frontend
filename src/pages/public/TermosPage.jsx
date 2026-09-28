import { Link } from 'react-router-dom'
import logo from '@/logo-dauth-agendamentos.png'

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="border-b border-line bg-surface px-6 py-4 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img src={logo} alt="Dauth" className="w-9 h-9 rounded-lg object-cover" />
          <span className="font-display font-semibold text-[14px]">Dauth Agendamentos</span>
        </Link>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-6 py-12">
        <p className="text-[11px] font-mono text-ink-4 uppercase tracking-widest mb-3">Legal</p>
        <h1 className="font-display font-medium text-[32px] tracking-tight mb-2">
          Termos de Uso
        </h1>
        <p className="text-[13px] text-ink-4 mb-10">Última atualização: maio de 2025</p>

        <div className="prose-dauth">

          <Section title="O que é o Dauth Agendamentos">
            <p>
              O <strong>Dauth Agendamentos</strong> é uma plataforma de software para gerenciamento de agendamentos,
              profissionais, caixa e clientes de salões de beleza. A plataforma é fornecida como serviço (SaaS) e
              acessada via navegador.
            </p>
            <p>
              Ao criar uma conta e utilizar a plataforma, você concorda com os termos descritos aqui.
            </p>
          </Section>

          <Section title="Uso adequado da plataforma">
            <p>Você concorda em usar a plataforma apenas para fins legítimos relacionados ao agendamento e gestão de serviços de beleza. É proibido:</p>
            <ul>
              <li>Criar contas falsas ou com informações incorretas.</li>
              <li>Tentar acessar dados de outros usuários sem autorização.</li>
              <li>Usar a plataforma para atividades ilegais ou que violem direitos de terceiros.</li>
              <li>Tentar comprometer a segurança ou estabilidade do sistema.</li>
            </ul>
          </Section>

          <Section title="Responsabilidades do salão (administrador)">
            <p>O salão que utiliza a plataforma é responsável por:</p>
            <ul>
              <li>Cadastrar informações corretas sobre serviços, preços e profissionais.</li>
              <li>Garantir que os profissionais cadastrados estejam cientes do uso da plataforma.</li>
              <li>Tratar os dados dos clientes com respeito e em conformidade com a LGPD.</li>
              <li>Manter as credenciais de acesso seguras e não compartilhar senhas.</li>
              <li>Responder a solicitações de clientes relacionadas aos seus dados pessoais.</li>
            </ul>
          </Section>

          <Section title="Responsabilidades do cliente (usuário)">
            <p>Como cliente da plataforma, você é responsável por:</p>
            <ul>
              <li>Manter seus dados cadastrais atualizados (nome, telefone, data de nascimento).</li>
              <li>Garantir que o número de celular cadastrado esteja correto e ativo — ele é usado para verificação e comunicados pelo WhatsApp.</li>
              <li>Manter sua senha segura e não compartilhá-la.</li>
              <li>Comparecer nos agendamentos confirmados ou cancelá-los com antecedência.</li>
            </ul>
          </Section>

          <Section title="Dados cadastrados na plataforma">
            <p>
              Os dados inseridos na plataforma (clientes, agendamentos, transações, serviços) são de
              responsabilidade do salão que os cadastra. A Dauth Agendamentos atua como processadora
              desses dados, conforme a LGPD.
            </p>
            <p>
              Não compartilhamos dados de clientes com terceiros, exceto quando necessário para o
              funcionamento do serviço (ex: envio de mensagens pelo WhatsApp via automação).
            </p>
          </Section>

          <Section title="Disponibilidade do sistema">
            <p>
              Fazemos o máximo para manter a plataforma disponível 24 horas por dia, 7 dias por semana.
              No entanto, podem ocorrer interrupções planejadas (manutenção) ou não planejadas (falhas técnicas).
            </p>
            <p>
              Não nos responsabilizamos por prejuízos causados por indisponibilidade temporária do sistema,
              desde que não decorrentes de negligência nossa.
            </p>
          </Section>

          <Section title="Limitações da plataforma">
            <p>
              A plataforma é uma ferramenta de organização e comunicação. Ela não substitui contratos de
              prestação de serviço entre o salão e seus clientes. Eventuais conflitos sobre atendimentos,
              pagamentos ou cancelamentos devem ser resolvidos diretamente entre o salão e o cliente.
            </p>
          </Section>

          <Section title="Cancelamento e exclusão de conta">
            <p>
              Você pode solicitar a exclusão da sua conta a qualquer momento. Após a exclusão:
            </p>
            <ul>
              <li>Seus dados pessoais são removidos em até 30 dias.</li>
              <li>O histórico de agendamentos e transações pode ser mantido pelo salão por obrigação legal.</li>
              <li>Não é possível recuperar a conta após a exclusão.</li>
            </ul>
            <p>
              O salão também pode desativar contas de clientes ou profissionais quando necessário,
              por motivos operacionais ou de segurança.
            </p>
          </Section>

          <Section title="Alterações nestes termos">
            <p>
              Podemos atualizar estes termos periodicamente. Em caso de alterações significativas,
              comunicaremos via WhatsApp ou aviso na plataforma. O uso continuado após a notificação
              implica aceitação dos novos termos.
            </p>
          </Section>

          <Section title="Contato">
            <p>
              Em caso de dúvidas sobre estes termos, entre em contato diretamente com o salão pelo WhatsApp.
            </p>
          </Section>

        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-line flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <p className="text-[12px] text-ink-4">© 2025 Dauth Agendamentos. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <Link to="/privacidade" className="text-[12px] text-ink-3 hover:text-ink transition-colors">
              Política de Privacidade
            </Link>
            <Link to="/login" className="text-[12px] text-ink-3 hover:text-ink transition-colors">
              Entrar
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="font-display font-medium text-[18px] tracking-tight mb-3 text-ink">{title}</h2>
      <div className="space-y-3 text-[14px] text-ink-2 leading-relaxed">{children}</div>
    </div>
  )
}
