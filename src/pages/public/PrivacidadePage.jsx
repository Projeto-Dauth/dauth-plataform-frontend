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
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-[11px] font-mono text-ink-4 uppercase tracking-widest mb-3">Legal</p>
        <h1 className="font-display font-medium text-[32px] tracking-tight mb-2">
          Política de Privacidade
        </h1>
        <p className="text-[13px] text-ink-4 mb-10">Última atualização: outubro de 2026</p>

        <div className="prose-dauth">

          <Section title="Quem somos">
            <p>
              O <strong>Dauth Agendamentos</strong> é uma plataforma de gestão de agendamentos para salões de beleza.
              Ajudamos salões a organizar atendimentos, profissionais e caixa em um só lugar.
            </p>
            <p>
              Este documento explica quais informações coletamos, por que coletamos e como as usamos.
            </p>
          </Section>

          <Section title="Quem decide sobre os seus dados">
            <p>
              Quando você é <strong>cliente ou profissional de um salão</strong>, o salão é o <strong>controlador</strong> dos
              seus dados: ele decide quais dados cadastrar e para quê. A Dauth atua como <strong>operadora</strong>,
              tratando esses dados apenas para entregar a plataforma ao salão, conforme a LGPD.
            </p>
            <p>
              Quando você é <strong>o responsável por um salão</strong> (quem contrata a Dauth), a Dauth é a controladora
              dos dados da sua conta e da sua assinatura: nome, e-mail, telefone e histórico de pagamentos.
            </p>
          </Section>

          <Section title="Quais dados coletamos">
            <p>Coletamos apenas o necessário para o funcionamento da plataforma:</p>
            <ul>
              <li><strong>Nome completo</strong> — para identificação nos agendamentos.</li>
              <li><strong>Número de celular</strong> — usado como login e para envio de mensagens pelo WhatsApp (confirmações e links de acesso).</li>
              <li><strong>E-mail</strong> — dos responsáveis por salões e de profissionais convidados por e-mail, para login, convites e avisos da assinatura.</li>
              <li><strong>Data de nascimento</strong> — para fins de identificação do perfil e aviso de aniversário, quando o salão o ativa.</li>
              <li><strong>Histórico de agendamentos</strong> — serviços agendados, datas, horários, status e observações escritas pelo salão ou por você.</li>
              <li><strong>Registros financeiros</strong> — transações, comandas, créditos e comissões geradas no salão (apenas administradores e profissionais autorizados têm acesso).</li>
              <li><strong>Assinatura do salão</strong> — plano, datas de vencimento e histórico de pagamentos da assinatura.</li>
              <li><strong>Dados técnicos de acesso</strong> — endereço IP e navegador usados no login, para segurança e limite de tentativas.</li>
            </ul>
            <p>
              Não coletamos CPF, RG, endereço de clientes nem dados de cartão de crédito. Não pedimos dados de saúde:
              pedimos que o campo de observações do agendamento não seja usado para registrar informações de saúde.
            </p>
          </Section>

          <Section title="Por que coletamos esses dados">
            <p>Usamos seus dados exclusivamente para:</p>
            <ul>
              <li>Criar e gerenciar sua conta na plataforma.</li>
              <li>Registrar e acompanhar seus agendamentos.</li>
              <li>Enviar mensagens de verificação e confirmação pelo WhatsApp.</li>
              <li>Permitir que o salão organize o atendimento de forma eficiente.</li>
              <li>Cobrar e controlar a assinatura do salão, e avisar sobre vencimento e renovação.</li>
              <li>Proteger a plataforma contra acessos indevidos e abusos.</li>
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
                  <td><code>better-auth.session_token</code></td>
                  <td>Mantém você logado</td>
                  <td>Até 7 dias</td>
                </tr>
                <tr>
                  <td><code>better-auth.session_data</code></td>
                  <td>Cópia curta da sessão, para agilizar as telas</td>
                  <td>5 minutos</td>
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
                  <td><code>dauth-auth</code>, <code>dauth-salon</code></td>
                  <td>Lembram quem está logado e o salão em uso, para não pedir login a cada tela</td>
                </tr>
                <tr>
                  <td><code>dauth_hide_values</code></td>
                  <td>Sua preferência de ocultar valores financeiros</td>
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
            <p>
              Para funcionar, a plataforma usa prestadores de serviço (operadores). Eles recebem apenas o
              necessário para a sua função, e alguns podem armazenar dados em servidores fora do Brasil
              (transferência internacional, nos termos dos arts. 33 a 36 da LGPD):
            </p>
            <ul>
              <li>
                <strong>Servidor e banco de dados da Dauth</strong> — onde ficam armazenados todos os dados da plataforma.
              </li>
              <li>
                <strong>Vercel</strong> — hospedagem do site; o tráfego entre o seu navegador e a plataforma passa por ela.
              </li>
              <li>
                <strong>WhatsApp</strong> — envio das mensagens de WhatsApp. São transmitidos o número
                de celular e o conteúdo da mensagem.
              </li>
              <li>
                <strong>Resend</strong> — envio de e-mails (confirmação de conta, convites e avisos da assinatura).
              </li>
              <li>
                <strong>AbacatePay</strong> — geração e confirmação do pagamento PIX da assinatura do salão.
                Não recebemos dados do seu cartão ou conta bancária.
              </li>
              <li>
                <strong>Cloudflare R2</strong> — armazenamento dos vídeos da documentação; não contém dados pessoais.
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
              Seus dados ficam armazenados enquanto sua conta estiver ativa. Se você solicitar a exclusão,
              eliminamos ou anonimizamos os dados pessoais em até 30 dias, salvo obrigação legal de retenção.
            </p>
            <p>
              Registros financeiros (comandas, transações e pagamentos de assinatura) podem ser mantidos por até
              5 anos para fins contábeis e fiscais, conforme exigência legal.
            </p>
            <p>
              Quando um salão é excluído, seus dados são apagados 30 dias após o pedido, período em que a exclusão
              ainda pode ser cancelada.
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
              Para exercer esses direitos, acesse <strong>Meu Perfil</strong> dentro da plataforma. Lá você pode
              editar seus dados e usar o botão <strong>"Exportar meus dados"</strong> para baixar um arquivo JSON
              com seu perfil e histórico de agendamentos. Se preferir, peça diretamente ao salão ou à Dauth pelo
              contato abaixo; respondemos em até 15 dias.
            </p>
          </Section>

          <Section title="Solicitação de exclusão de conta">
            <p>
              Para solicitar a exclusão da sua conta e dos seus dados pessoais, envie um e-mail para o contato
              abaixo informando seu nome e o número de celular cadastrado, ou fale com o salão.
            </p>
            <p>
              Atendemos o pedido em até 30 dias. Dados que precisamos guardar por obrigação legal (como registros
              financeiros) são mantidos apenas pelo prazo exigido. Após a exclusão, não é possível recuperar a conta.
            </p>
          </Section>

          <Section title="Segurança">
            <p>
              Adotamos boas práticas de segurança para proteger seus dados:
            </p>
            <ul>
              <li>Comunicação criptografada via HTTPS.</li>
              <li>Senhas armazenadas com hash seguro (scrypt); nunca guardamos a senha em texto.</li>
              <li>Sessão em cookies httpOnly (não acessíveis por JavaScript).</li>
              <li>Controle de acesso por perfil (admin, profissional, cliente) e isolamento dos dados entre salões.</li>
              <li>Limite de tentativas de login.</li>
            </ul>
            <p>
              Se ocorrer um incidente de segurança que possa causar risco ou dano relevante, comunicaremos os
              salões afetados e a Autoridade Nacional de Proteção de Dados (ANPD) nos prazos da lei.
            </p>
          </Section>

          <Section title="Contato">
            <p>
              Dúvidas sobre esta política ou sobre o tratamento dos seus dados: <strong>contato@dauth.com.br</strong>.
              Se o seu cadastro é de um salão, você também pode falar diretamente com ele.
            </p>
          </Section>

        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-line flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <p className="text-[12px] text-ink-4">© 2026 Dauth Agendamentos. Todos os direitos reservados.</p>
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
