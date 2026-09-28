import { Link } from 'react-router-dom'
import logo from '@/logo-dauth-agendamentos.png'

export default function PrivacidadePage() {
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
          Política de Privacidade
        </h1>
        <p className="text-[13px] text-ink-4 mb-10">Última atualização: maio de 2025</p>

        <div className="prose-dauth">

          <Section title="Quem somos">
            <p>
              O <strong>Dauth Agendamentos</strong> é uma plataforma de gestão de agendamentos para salões de beleza.
              Desenvolvemos este produto para ajudar salões a organizar seus atendimentos, profissionais e caixa
              em um só lugar.
            </p>
            <p>
              Este documento explica quais informações coletamos, por que coletamos e como as usamos.
              Nosso compromisso é ser transparente e tratar seus dados com responsabilidade.
            </p>
          </Section>

          <Section title="Quais dados coletamos">
            <p>Coletamos apenas o necessário para o funcionamento da plataforma:</p>
            <ul>
              <li><strong>Nome completo</strong> — para identificação nos agendamentos.</li>
              <li><strong>Número de celular</strong> — usado como login e para envio de mensagens pelo WhatsApp (confirmações e links de acesso).</li>
              <li><strong>Data de nascimento</strong> — para fins de identificação do perfil.</li>
              <li><strong>Histórico de agendamentos</strong> — serviços agendados, datas, horários e status.</li>
              <li><strong>Registros financeiros</strong> — transações e comandas geradas no salão (apenas admin e profissionais têm acesso a esses dados).</li>
            </ul>
            <p>
              Não coletamos documentos como CPF ou RG. Não coletamos endereço. Não coletamos dados de cartão de crédito.
            </p>
          </Section>

          <Section title="Por que coletamos esses dados">
            <p>Usamos seus dados exclusivamente para:</p>
            <ul>
              <li>Criar e gerenciar sua conta na plataforma.</li>
              <li>Registrar e acompanhar seus agendamentos.</li>
              <li>Enviar mensagens de verificação e confirmação pelo WhatsApp.</li>
              <li>Permitir que o salão organize o atendimento de forma eficiente.</li>
            </ul>
            <p>Não usamos seus dados para publicidade, perfis comportamentais ou venda a terceiros.</p>
          </Section>

          <Section title="WhatsApp e mensagens automáticas">
            <p>
              Usamos o WhatsApp para enviar mensagens relacionadas à sua conta:
            </p>
            <ul>
              <li>Link de verificação ao criar conta.</li>
              <li>Link para redefinição de senha.</li>
              <li>Confirmações de agendamento (quando configurado pelo salão).</li>
            </ul>
            <p>
              As mensagens são enviadas para o número de celular cadastrado por você.
              Não enviamos spam, promoções ou qualquer mensagem não relacionada ao uso da plataforma.
            </p>
          </Section>

          <Section title="Cookies e armazenamento local">
            <p>Usamos dois tipos de armazenamento:</p>
            <Subtitle>Cookies de sessão (httpOnly)</Subtitle>
            <p>
              São cookies essenciais para manter você logado. São marcados como <em>httpOnly</em>,
              o que significa que nenhum script do navegador consegue lê-los — isso os torna mais seguros.
              Não usamos cookies de rastreamento, analytics ou publicidade.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Cookie</th>
                  <th>Finalidade</th>
                  <th>Duração</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>access_token</code></td>
                  <td>Autenticação da sessão</td>
                  <td>~1 hora</td>
                </tr>
                <tr>
                  <td><code>refresh_token</code></td>
                  <td>Renovação automática da sessão</td>
                  <td>7 dias</td>
                </tr>
              </tbody>
            </table>

            <Subtitle>Armazenamento local (localStorage)</Subtitle>
            <p>Guardamos algumas preferências no seu navegador:</p>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Finalidade</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>auth_public_id</code></td>
                  <td>Identificador da sessão do usuário</td>
                </tr>
                <tr>
                  <td><code>dauth_tour_*</code></td>
                  <td>Registro de tutoriais já vistos na plataforma</td>
                </tr>
                <tr>
                  <td><code>dauth_cookies_accepted</code></td>
                  <td>Data e hora em que você consentiu com esta política (formato ISO 8601)</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section title="Integrações externas">
            <p>O sistema se conecta com os seguintes serviços:</p>
            <ul>
              <li>
                <strong>Supabase</strong> — banco de dados e autenticação. Seus dados ficam armazenados em
                servidores seguros do Supabase, com criptografia em trânsito e em repouso.
              </li>
              <li>
                <strong>N8N (automação)</strong> — plataforma de automação usada para enviar as mensagens de
                WhatsApp. Apenas o número de celular e o conteúdo da mensagem são transmitidos.
              </li>
              <li>
                <strong>Google Fonts</strong> — carregamento de fontes tipográficas. Isso pode registrar seu
                endereço IP nos servidores do Google, mas não é vinculado à sua identidade na plataforma.
              </li>
            </ul>
            <p>
              Não usamos Google Analytics, Meta Pixel, Microsoft Clarity ou qualquer outra ferramenta de rastreamento.
            </p>
          </Section>

          <Section title="Quanto tempo guardamos seus dados">
            <p>
              Seus dados ficam armazenados enquanto sua conta estiver ativa. Se você solicitar a exclusão da conta,
              os dados pessoais são removidos em até 30 dias, salvo obrigação legal de retenção.
            </p>
            <p>
              Registros financeiros (comandas e transações) podem ser mantidos por até 5 anos para fins contábeis
              do salão, conforme exigência legal.
            </p>
          </Section>

          <Section title="Seus direitos (LGPD)">
            <p>
              Pela Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem direito a:
            </p>
            <ul>
              <li>Saber quais dados temos sobre você.</li>
              <li>Corrigir dados incorretos ou desatualizados.</li>
              <li>Solicitar a exclusão dos seus dados.</li>
              <li>Revogar o consentimento de uso dos seus dados.</li>
              <li>Receber seus dados em formato legível (portabilidade).</li>
            </ul>
            <p>
              Para exercer qualquer um desses direitos, acesse <strong>Meu Perfil</strong> dentro da plataforma.
              Lá você pode editar seus dados diretamente e usar o botão <strong>"Exportar meus dados"</strong> para
              baixar um arquivo JSON com seu perfil e histórico de agendamentos.
              Para solicitar a exclusão da conta, entre em contato pelo WhatsApp do salão.
            </p>
          </Section>

          <Section title="Solicitação de exclusão de conta">
            <p>
              Para solicitar a exclusão da sua conta e de todos os seus dados pessoais, você pode:
            </p>
            <ul>
              <li>Entrar em contato diretamente com o salão pelo WhatsApp.</li>
              <li>Enviar um e-mail para o responsável do salão informando seu nome e número cadastrado.</li>
            </ul>
            <p>
              Processamos as solicitações em até 30 dias. Após a exclusão, não é possível recuperar a conta.
            </p>
          </Section>

          <Section title="Segurança">
            <p>
              Adotamos boas práticas de segurança para proteger seus dados:
            </p>
            <ul>
              <li>Comunicação criptografada via HTTPS.</li>
              <li>Senhas armazenadas com hash seguro (bcrypt).</li>
              <li>Tokens de sessão em cookies httpOnly (não acessíveis por JavaScript).</li>
              <li>Controle de acesso por perfil (admin, profissional, cliente).</li>
            </ul>
          </Section>

          <Section title="Contato">
            <p>
              Em caso de dúvidas sobre esta política ou sobre o tratamento dos seus dados,
              entre em contato com o salão diretamente.
            </p>
          </Section>

        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-line flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <p className="text-[12px] text-ink-4">© 2025 Dauth Agendamentos. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <Link to="/termos" className="text-[12px] text-ink-3 hover:text-ink transition-colors">
              Termos de Uso
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

function Subtitle({ children }) {
  return <p className="font-medium text-ink mt-4 mb-1">{children}</p>
}
