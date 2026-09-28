import { useState } from 'react'
import { Link } from 'react-router-dom'
import logo from '@/logo-dauth-agendamentos.png'

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const FEATURES = [
  { label: 'histórico', title: 'Sua ficha de cuidados', desc: 'Fórmula da última coloração, fotos do corte, observações da profissional. Tudo num lugar — pra você ou pra quem te atende da próxima vez.' },
  { label: 'favoritos', title: 'Profissionais que viram referência', desc: 'Quando encontra alguém que entende seu cabelo, salve. Receba aviso quando ela abrir agenda do mês seguinte.' },
  { label: 'lembretes', title: 'Sem culpa, sem esquecimento', desc: 'Aviso na véspera, na hora certa. Botão grande pra remarcar quando o dia virar. Sem cobrança no atrito.' },
  { label: 'pacotes', title: 'Compre uma vez, use durante meses', desc: 'Pacotes de cortes, hidratações ou retoque de raiz com desconto. O app conta as sessões usadas — você só agenda.' },
  { label: 'pagamento', title: 'Pix no app, cartão no salão', desc: 'Pague antes ou depois. Divida em até 3x sem juros. Recibo automático no seu e-mail.' },
  { label: 'curadoria', title: 'Salões verificados, um por um', desc: 'Visitamos pessoalmente. Conferimos higiene, acolhimento, produtos. Não é qualquer salão que entra.' },
]

const FAQS = [
  { q: 'Preciso instalar algum aplicativo?', a: 'Não. O Dauth é uma plataforma 100% web — você acessa direto pelo navegador do celular, do tablet ou do computador. A experiência é otimizada para mobile e funciona de forma idêntica em qualquer tela. Sem ocupar espaço no aparelho.' },
  { q: 'O Dauth é gratuito para mim?', a: 'Sim, totalmente. Você acessa, agenda e usa sem nenhuma taxa. Quem paga uma pequena taxa por agendamento é o salão parceiro — e isso não vira sobrepreço pra você.' },
  { q: 'Em quais cidades já funciona?', a: 'Estamos em todo o Rio Grande do Sul, com presença forte em Porto Alegre, Caxias do Sul, Canoas, Pelotas, Santa Maria e Novo Hamburgo. Outras cidades gaúchas entram a cada mês.' },
  { q: 'Os salões são confiáveis?', a: 'Cada salão passa por uma visita presencial antes de entrar no app. Conferimos higiene, atendimento, produtos e portfólio das profissionais. Quem não atende o padrão, não entra.' },
  { q: 'Como funciona o pagamento?', a: 'Você escolhe: paga pelo app via Pix ou cartão (em até 3x sem juros), ou paga direto no salão depois do atendimento. Pacotes mensais são pagos antecipadamente, mas as sessões você usa quando quiser.' },
  { q: 'E se eu precisar cancelar de última hora?', a: 'Cancela ou remarca em um toque até 4h antes do horário, sem taxa. Acima desse limite, depende da política de cada salão — mas o app sempre mostra a regra antes de você confirmar.' },
  { q: 'Vou conseguir usar com a profissional que já confio?', a: 'Se o salão dela já é parceiro, sim — você escolhe ela na hora de marcar. Se ainda não é, conta pra gente: a gente entra em contato com o salão e convida.' },
]

const BRANDS = ['Vogue Brasil', 'Glamour', 'Marie Claire', 'Estadão Beleza', 'Folha · Mulher', 'Capricho']

const NAV_LINKS = [
  { href: '#como', label: 'Como funciona' },
  { href: '#servicos', label: 'Serviços' },
  { href: '#salons', label: 'Para salões' },
  { href: '#historias', label: 'Histórias' },
  { href: '#faq', label: 'Perguntas' },
]

export default function PortalPage() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="font-body text-ink antialiased">

      {/* ── HEADER ── */}
      <header className="border-b border-line sticky top-0 z-30 backdrop-blur-sm" style={{ background: 'rgba(253,244,245,0.95)' }}>
        <div className="max-w-[1320px] mx-auto px-4 md:px-8 h-[64px] md:h-[72px] flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Dauth" className="w-9 h-9 rounded-lg object-cover" />
            <div className="leading-tight">
              <div className="font-display font-medium text-[18px] tracking-tight">Dauth</div>
              <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4 -mt-0.5">agendamentos</div>
            </div>
          </Link>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-8 text-[14px] text-ink-2">
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href} className="hover:text-brand transition-colors">{l.label}</a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden sm:inline-flex h-[40px] items-center px-4 rounded-md text-[14px] hover:bg-brand-soft transition-colors">
              Entrar
            </Link>
            <Link to="/agendar" className="hidden sm:inline-flex h-[40px] items-center gap-2 px-5 rounded-md text-[14px] font-medium bg-ink text-bg hover:bg-ink-2 transition-colors">
              Acessar agora <ArrowRight />
            </Link>
            {/* Hambúrguer — só mobile */}
            <button
              onClick={() => setMenuOpen(true)}
              className="md:hidden flex flex-col justify-center items-center w-10 h-10 rounded-lg border border-line hover:bg-surface-2 transition-colors gap-[5px]"
              aria-label="Abrir menu"
            >
              <span className="w-5 h-[1.5px] bg-ink rounded-full" />
              <span className="w-5 h-[1.5px] bg-ink rounded-full" />
              <span className="w-5 h-[1.5px] bg-ink rounded-full" />
            </button>
          </div>
        </div>
      </header>

      {/* ── DRAWER MOBILE ── */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          {/* Painel */}
          <div className="absolute top-0 right-0 h-full w-[280px] bg-bg border-l border-line flex flex-col shadow-md">
            {/* Header do drawer */}
            <div className="flex items-center justify-between px-5 h-[64px] border-b border-line">
              <div className="flex items-center gap-2.5">
                <img src={logo} alt="Dauth" className="w-7 h-7 rounded-lg object-cover" />
                <span className="font-display font-medium text-[15px] tracking-tight">Dauth</span>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="w-9 h-9 rounded-lg border border-line flex items-center justify-center hover:bg-surface-2 transition-colors text-ink-3"
                aria-label="Fechar menu"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Links */}
            <nav className="flex flex-col px-3 py-4 gap-1 flex-1">
              {NAV_LINKS.map(l => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-3 rounded-lg text-[15px] text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
                >
                  {l.label}
                </a>
              ))}
            </nav>

            {/* CTAs */}
            <div className="px-4 pb-8 flex flex-col gap-2.5 border-t border-line pt-4">
              <Link
                to="/agendar"
                onClick={() => setMenuOpen(false)}
                className="flex justify-center items-center h-[46px] rounded-md bg-ink text-bg text-[14px] font-medium hover:bg-ink-2 transition-colors"
              >
                Acessar agora
              </Link>
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="flex justify-center items-center h-[46px] rounded-md border border-line text-[14px] text-ink-2 hover:bg-surface-2 transition-colors"
              >
                Entrar na conta
              </Link>
            </div>
          </div>
        </div>
      )}


      {/* ── HERO ── */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="max-w-[1320px] mx-auto px-4 md:px-8 pt-14 md:pt-20 pb-16 md:pb-24 grid grid-cols-12 gap-6 md:gap-10">

          {/* Left */}
          <div className="col-span-12 lg:col-span-7">
            <div className="flex items-center gap-3 mb-8 md:mb-10 flex-wrap">
              <span className="bg-bg border border-line rounded-full px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-widest text-ink-2 shadow-xs">
                novo · beta aberta
              </span>
              <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4 hidden sm:inline">
                disponível no rio grande do sul
              </span>
            </div>

            <h1 className="font-display font-medium leading-[0.92] tracking-tight mb-3 text-ink" style={{ fontSize: 'clamp(48px, 8vw, 92px)' }}>
              Sua beleza,<br />
              <span className="font-serif italic font-normal text-brand" style={{ fontSize: 'clamp(54px, 9vw, 100px)' }}>
                marcada
              </span>{' '}
              com calma.
            </h1>

            <p className="text-[16px] md:text-[19px] leading-[1.55] text-ink-2 max-w-[520px] mt-6 md:mt-8 mb-8 md:mb-10">
              O Dauth conecta você aos melhores salões do Rio Grande do Sul. Tudo pelo navegador — funciona perfeito no celular, no tablet, no computador. Sem instalar, sem ocupar espaço.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-10 md:mb-12">
              <Link to="/agendar" className="inline-flex h-[50px] md:h-[54px] items-center gap-3 px-6 md:px-7 rounded-md text-[14px] md:text-[15px] font-medium bg-ink text-bg hover:bg-ink-2 transition-colors">
                Acessar agora <ArrowRight />
              </Link>
              <a href="#servicos" className="inline-flex h-[50px] md:h-[54px] items-center px-5 md:px-6 rounded-md text-[14px] md:text-[15px] border border-line hover:bg-brand-soft transition-colors">
                Explorar serviços
              </a>
            </div>

            <div className="grid grid-cols-3 gap-4 md:gap-6 max-w-[480px] md:max-w-[560px] border-t border-line pt-6 md:pt-7">
              {[
                { val: '180+', label: 'salões parceiros · rs' },
                { val: '22k', label: 'horários marcados' },
                { val: '4.9', sub: '/5', label: 'avaliação das clientes' },
              ].map(({ val, sub, label }) => (
                <div key={label}>
                  <div className="font-display font-medium text-[24px] md:text-[28px] text-ink leading-none">
                    {val}{sub && <span className="text-ink-4 text-[17px]">{sub}</span>}
                  </div>
                  <div className="font-mono text-[10px] md:text-[10.5px] uppercase tracking-widest text-ink-3 mt-2">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: phone mockup — desktop only */}
          <div className="col-span-12 lg:col-span-5 relative min-h-[600px] hidden lg:block">
            <div className="absolute top-0 right-0 w-[78%] aspect-[4/5] rounded-md overflow-hidden ph-warm-3 grain border border-line" />

            <div className="absolute bottom-0 left-0 phone">
              <div className="phone-screen">
                <div className="px-5 pt-12 pb-4 flex items-center justify-between border-b border-line">
                  <div>
                    <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4">terça · 28 abr</div>
                    <div className="font-display font-medium text-[18px] text-ink mt-0.5">olá, Marina</div>
                  </div>
                  <div className="w-9 h-9 rounded-full ph-warm-2" />
                </div>
                <div className="px-5 py-4">
                  <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-3">próximo agendamento</div>
                  <div className="rounded-md border border-line p-4" style={{ background: 'rgba(245,239,233,0.6)' }}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-md ph-warm-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-medium text-[14px] text-ink">Camila · coloração</div>
                        <div className="text-[12px] text-ink-3 mt-0.5">Salão Bela Arte</div>
                        <div className="font-mono text-[10.5px] uppercase tracking-widest text-brand mt-2">amanhã · 14h00</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-5">
                  <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-3">para você</div>
                  <div className="flex flex-col gap-2">
                    {[
                      { name: 'Studio Lume', sub: 'manicure · 1.2km', time: '15h', ph: 'ph-warm-2' },
                      { name: 'Casa Verbena', sub: 'sobrancelha · 2.4km', time: '17h', ph: 'ph-warm-4' },
                    ].map((item) => (
                      <div key={item.name} className="rounded-md border border-line p-3 flex items-center gap-3 bg-surface">
                        <div className={`w-9 h-9 rounded-md ${item.ph} shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium text-ink truncate">{item.name}</div>
                          <div className="font-mono text-[10px] uppercase tracking-widest text-ink-4">{item.sub}</div>
                        </div>
                        <span className="font-mono text-[10.5px] uppercase tracking-widest text-brand">{item.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute top-8 left-2 bg-bg border border-line rounded-full px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-widest text-ink-2 shadow-sm -rotate-6">
              100% web · sem instalar
            </div>
            <div className="absolute bottom-12 right-4 bg-bg border border-line rounded-md p-4 shadow-sm w-[230px]">
              <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4 mb-1">funciona em</div>
              <div className="font-display font-medium text-[22px] text-ink leading-none">celular · tablet<br />desktop</div>
              <div className="text-[11px] text-ink-3 mt-2 leading-tight">mesma experiência em qualquer tela</div>
            </div>
          </div>
        </div>

        <div className="absolute right-0 top-1/3 w-[1px] h-32 bg-gold hidden lg:block" />
      </section>

      {/* ── MARQUEE ── */}
      <section className="border-y border-line overflow-hidden" style={{ background: 'rgba(245,239,233,0.5)' }}>
        <div className="py-5 md:py-6 overflow-hidden">
          <div className="marquee-track">
            {[...BRANDS, ...BRANDS].map((brand, i) => (
              <span key={i} className="flex items-center gap-10 shrink-0">
                <span className="font-serif italic text-[20px] md:text-[22px] text-ink-3">como visto em</span>
                <span className="font-display font-medium text-[20px] md:text-[22px] text-ink-2">{brand}</span>
                <span className="text-gold">◆</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEMA / VIRADA ── */}
      <section className="border-b border-line">
        <div className="max-w-[1320px] mx-auto px-4 md:px-8 py-20 md:py-28">
          <div className="grid grid-cols-12 gap-6 md:gap-10 mb-14 md:mb-20">
            <div className="col-span-12 md:col-span-2">
              <div className="font-mono text-[10.5px] uppercase tracking-widest text-brand">// 01</div>
            </div>
            <div className="col-span-12 md:col-span-10">
              <h2 className="font-display font-medium leading-[1.02] text-ink" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>
                Beleza não devia depender de mensagem não respondida<span className="text-brand">.</span>
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="border border-line rounded-md p-6 md:p-8 h-full" style={{ background: 'rgba(245,239,233,0.4)' }}>
              <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4 mb-6">antes</div>
              <ul className="flex flex-col gap-4 md:gap-5 text-[15px] md:text-[16px] leading-[1.55] text-ink-2">
                {['Você manda mensagem perguntando se tem horário', 'Espera meia hora pela resposta', 'O horário que serve já não está disponível', 'Vocês trocam mais cinco mensagens', 'Você esquece, perde o horário, paga taxa'].map((item, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="font-serif italic text-gold text-[20px] leading-none mt-1 shrink-0">{['i.','ii.','iii.','iv.','v.'][i]}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border border-ink rounded-md p-6 md:p-8 bg-ink text-bg h-full">
              <div className="font-mono text-[10.5px] uppercase tracking-widest text-gold mb-6">com Dauth</div>
              <ul className="flex flex-col gap-4 md:gap-5 text-[15px] md:text-[16px] leading-[1.55]" style={{ color: 'rgba(253,244,245,0.85)' }}>
                {['Abre o app e vê todos os horários reais, em tempo real', 'Escolhe a profissional — vê portfólio e avaliações', 'Confirma com um toque. Recebe lembrete na véspera', 'Remarca em segundos se precisar — sem culpa', 'O app guarda seu histórico — fórmula, profissional, foto'].map((item, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="font-serif italic text-gold text-[20px] leading-none mt-1 shrink-0">{['i.','ii.','iii.','iv.','v.'][i]}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section id="como" className="border-b border-line" style={{ background: 'rgba(245,236,226,0.4)' }}>
        <div className="max-w-[1320px] mx-auto px-4 md:px-8 py-20 md:py-28">
          <div className="grid grid-cols-12 gap-6 md:gap-10 mb-12 md:mb-16">
            <div className="col-span-12 md:col-span-2">
              <div className="font-mono text-[10.5px] uppercase tracking-widest text-brand">// 02</div>
            </div>
            <div className="col-span-12 md:col-span-10">
              <h2 className="font-display font-medium leading-[1.02] text-ink mb-4 md:mb-6" style={{ fontSize: 'clamp(28px, 5vw, 56px)' }}>
                Três passos. <span className="font-serif italic font-normal text-brand">Beleza.</span>
              </h2>
              <p className="text-[16px] md:text-[18px] text-ink-2 max-w-[520px] leading-[1.55]">
                Pensado para quem tem rotina apertada e não quer perder uma tarde tentando marcar um horário.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { num: '01', ph: 'ph-warm-1', textCol: 'text-bg', title: 'Encontre seu lugar', desc: 'Filtre por serviço, bairro, faixa de preço ou estilo. Veja portfólio antes de marcar.', card: '"manicure perto de mim, depois das 18h"', cardLabel: 'explore' },
              { num: '02', ph: 'ph-warm-2', textCol: 'text-ink', title: 'Escolha quem cuida', desc: 'Cada profissional tem ficha completa: especialidades, fotos de trabalhos, avaliações reais.', card: null, cardLabel: null },
              { num: '03', ph: 'ph-warm-3', textCol: 'text-bg', title: 'Confirme em segundos', desc: 'Pague no salão ou pelo app. Lembrete chega na véspera. Remarque em um toque, sem constrangimento.', card: null, cardLabel: null },
            ].map((step, i) => (
              <article key={step.num} className={`relative ${i === 1 ? 'md:mt-12' : ''} ${i === 2 ? 'md:mt-24' : ''}`}>
                <div className={`${step.ph} grain rounded-md aspect-[4/5] mb-6 relative overflow-hidden`}>
                  <div className={`absolute top-5 left-5 font-serif italic font-medium ${step.textCol} leading-none`} style={{ fontSize: 88 }}>
                    {step.num}
                  </div>
                  <div className="absolute bottom-5 left-5 right-5">
                    {step.num === '02' ? (
                      <div className="bg-bg/90 backdrop-blur-sm rounded-md p-3 border border-line flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full ph-warm-3 shrink-0" />
                        <div className="flex-1">
                          <div className="text-[12px] font-medium text-ink">Camila R.</div>
                          <div className="font-mono text-[10px] uppercase tracking-widest text-gold">★ 4.9 · colorista</div>
                        </div>
                      </div>
                    ) : step.num === '03' ? (
                      <div className="bg-bg/90 backdrop-blur-sm rounded-md p-3 border border-line">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-mono text-[10px] uppercase tracking-widest text-ink-4">qua · 30 abr</div>
                          <div className="font-mono text-[10px] uppercase tracking-widest text-success">confirmado</div>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {[{t:'14h',a:false},{t:'14h30',a:true},{t:'15h',a:false},{t:'15h30',a:false}].map(s => (
                            <div key={s.t} className={`text-center text-[11px] py-1 rounded ${s.a ? 'bg-brand text-bg font-medium' : 'bg-line text-ink-4'}`}>{s.t}</div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-bg/90 backdrop-blur-sm rounded-md p-3 border border-line">
                        <div className="font-mono text-[10px] uppercase tracking-widest text-ink-4 mb-1">{step.cardLabel}</div>
                        <div className="text-[13px] text-ink-2 leading-tight">{step.card}</div>
                      </div>
                    )}
                  </div>
                </div>
                <h3 className="font-display font-medium text-[22px] md:text-[24px] text-ink mb-2">{step.title}</h3>
                <p className="text-[14px] md:text-[15px] text-ink-3 leading-[1.6] max-w-[300px]">{step.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVIÇOS ── */}
      <section id="servicos" className="border-b border-line">
        <div className="max-w-[1320px] mx-auto px-4 md:px-8 py-20 md:py-28">
          <div className="grid grid-cols-12 gap-6 md:gap-10 mb-10 md:mb-14">
            <div className="col-span-12 md:col-span-2">
              <div className="font-mono text-[10.5px] uppercase tracking-widest text-brand">// 03</div>
            </div>
            <div className="col-span-12 md:col-span-10 flex items-end justify-between flex-wrap gap-6">
              <h2 className="font-display font-medium leading-[1.02] text-ink max-w-[800px]" style={{ fontSize: 'clamp(28px, 5vw, 56px)' }}>
                Tudo o que você precisa<br />numa só <span className="font-serif italic font-normal text-brand">página</span>.
              </h2>
              <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4">12 categorias · 180+ salões no rs</span>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3 md:gap-4">
            <Link to="/agendar" className="col-span-12 md:col-span-6 group">
              <div className="ph-warm-3 grain rounded-md aspect-[16/10] relative overflow-hidden border border-line">
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
                <div className="absolute top-5 md:top-6 left-5 md:left-6">
                  <span className="bg-bg border border-line rounded-full px-3 py-1 font-mono text-[10.5px] uppercase tracking-widest text-ink-2">categoria · cabelo</span>
                </div>
                <div className="absolute bottom-5 md:bottom-6 left-5 md:left-6 right-5 md:right-6 text-bg">
                  <div className="font-display font-medium text-[28px] md:text-[40px] leading-tight">Cabelo &amp; coloração</div>
                  <div className="text-[13px] md:text-[14px] mt-2" style={{ color: 'rgba(253,244,245,0.8)' }}>
                    Cortes, mechas, balayage, hidratação, escovas. <span className="font-serif italic">A partir de R$ 45.</span>
                  </div>
                </div>
                <div className="absolute top-5 md:top-6 right-5 md:right-6 w-10 h-10 rounded-full bg-bg/95 flex items-center justify-center group-hover:bg-bg transition-colors">
                  <ArrowRight />
                </div>
              </div>
            </Link>

            <Link to="/agendar" className="col-span-12 md:col-span-3 group">
              <div className="ph-warm-1 grain rounded-md aspect-[4/5] relative overflow-hidden border border-line">
                <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 text-bg">
                  <div className="font-display font-medium text-[20px] md:text-[22px] leading-tight">Manicure &amp; pedicure</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest mt-1" style={{ color: 'rgba(253,244,245,0.7)' }}>a partir de R$ 35</div>
                </div>
              </div>
            </Link>

            <Link to="/agendar" className="col-span-12 md:col-span-3 group">
              <div className="ph-warm-4 grain rounded-md aspect-[4/5] relative overflow-hidden border border-line">
                <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 text-bg">
                  <div className="font-display font-medium text-[20px] md:text-[22px] leading-tight">Sobrancelhas &amp; cílios</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest mt-1" style={{ color: 'rgba(253,244,245,0.7)' }}>a partir de R$ 40</div>
                </div>
              </div>
            </Link>

            {[
              { ph: 'ph-warm-2', title: 'Estética facial', sub: 'limpeza · peeling' },
              { ph: 'ph-warm-5', title: 'Maquiagem', sub: 'eventos · social' },
              { ph: 'ph-warm-6', title: 'Depilação', sub: 'cera · laser' },
              { ph: 'ph-warm-3', title: 'Massagem &amp; spa', sub: 'relaxante · drenagem' },
            ].map((item) => (
              <Link key={item.title} to="/agendar" className="col-span-6 md:col-span-3 group">
                <div className={`${item.ph} grain rounded-md aspect-square relative overflow-hidden border border-line`}>
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 text-bg">
                    <div className="font-display font-medium text-[16px] md:text-[18px] leading-tight" dangerouslySetInnerHTML={{ __html: item.title }} />
                    <div className="font-mono text-[10px] uppercase tracking-widest mt-1" style={{ color: 'rgba(253,244,245,0.7)' }}>{item.sub}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8 md:mt-10 flex items-center justify-between flex-wrap gap-3">
            <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4">+ 5 categorias · ver todas no portal</span>
            <Link to="/agendar" className="inline-flex h-[44px] items-center px-5 rounded-md text-[14px] font-medium bg-brand text-white hover:bg-[#743c22] transition-colors">
              Acessar e explorar
            </Link>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="border-b border-line bg-ink text-bg">
        <div className="max-w-[1320px] mx-auto px-4 md:px-8 py-20 md:py-28">
          <div className="grid grid-cols-12 gap-6 md:gap-10 mb-12 md:mb-16">
            <div className="col-span-12 md:col-span-2">
              <div className="font-mono text-[10.5px] uppercase tracking-widest text-gold">// 04</div>
            </div>
            <div className="col-span-12 md:col-span-10">
              <h2 className="font-display font-medium leading-[1.02] text-bg max-w-[820px]" style={{ fontSize: 'clamp(28px, 5vw, 56px)' }}>
                Pensado para quem<br />volta sempre — e quer<br />ser <span className="font-serif italic font-normal text-gold">reconhecida</span>.
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-bg/15 border border-bg/15 rounded-md overflow-hidden">
            {FEATURES.map((f) => (
              <article key={f.label} className="bg-ink p-6 md:p-8">
                <div className="font-mono text-[10.5px] uppercase tracking-widest text-gold mb-5">{f.label}</div>
                <div className="font-display font-medium text-[20px] md:text-[24px] mb-3">{f.title}</div>
                <p className="text-[13px] md:text-[14px] leading-[1.6]" style={{ color: 'rgba(253,244,245,0.7)' }}>{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ── */}
      <section id="historias" className="border-b border-line">
        <div className="max-w-[1320px] mx-auto px-4 md:px-8 py-20 md:py-28">
          <div className="grid grid-cols-12 gap-6 md:gap-10 mb-12 md:mb-16">
            <div className="col-span-12 md:col-span-2">
              <div className="font-mono text-[10.5px] uppercase tracking-widest text-brand">// 05</div>
            </div>
            <div className="col-span-12 md:col-span-10 flex items-end justify-between flex-wrap gap-4">
              <h2 className="font-display font-medium leading-[1.02] text-ink" style={{ fontSize: 'clamp(28px, 5vw, 56px)' }}>
                Histórias <span className="font-serif italic font-normal text-brand">reais.</span>
              </h2>
              <div className="flex items-center gap-3">
                <div className="font-display font-medium text-[24px] md:text-[28px] text-ink">4.9</div>
                <div className="text-[12px] text-ink-3 leading-tight">
                  de 1.842 avaliações<br />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-4">clientes verificadas · rs</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4 md:gap-6">
            <article className="col-span-12 lg:col-span-7 border border-line rounded-md p-7 md:p-10 relative" style={{ background: 'rgba(245,239,233,0.6)' }}>
              <div className="font-serif italic text-gold leading-none absolute top-4 md:top-6 left-6 md:left-8 opacity-50" style={{ fontSize: 120 }}>"</div>
              <div className="font-display text-gold text-[14px] md:text-[16px] mb-4 md:mb-5 relative">★★★★★</div>
              <p className="font-serif italic text-[20px] md:text-[26px] leading-[1.4] text-ink mb-6 md:mb-8 relative max-w-[640px]">
                Eu odiava marcar horário. Detestava ligar, detestava ficar esperando resposta. O Dauth virou o jogo — abro pelo celular em qualquer lugar e pronto, marcado.
              </p>
              <div className="flex items-center gap-4 pt-5 md:pt-6 border-t border-line">
                <div className="ph-warm-1 w-12 md:w-14 h-12 md:h-14 rounded-full border border-line shrink-0" />
                <div>
                  <div className="font-display font-medium text-[15px] md:text-[16px] text-ink">Marina Cavalcanti</div>
                  <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4 mt-1">porto alegre · usa há 8 meses</div>
                </div>
              </div>
            </article>

            <div className="col-span-12 lg:col-span-5 flex flex-col gap-4 md:gap-6">
              {[
                { text: '"Achei minha colorista pela curadoria do Dauth. Foto do trabalho dela combinava com o que eu queria — fui, deu certo, e nunca mais saí."', name: 'Beatriz F.', sub: 'descobriu na curadoria', ph: 'ph-warm-2' },
                { text: '"Pacote mensal de hidratação salvou meu cabelo. O Dauth lembra quantas sessões ainda tenho. Já indiquei pra umas 12 amigas aqui em Caxias."', name: 'Tatiana M.', sub: 'caxias do sul · pacote hidratação', ph: 'ph-warm-3' },
              ].map((t) => (
                <article key={t.name} className="border border-line rounded-md p-6 md:p-7 bg-surface">
                  <div className="font-display text-gold text-[13px] md:text-[14px] mb-3 md:mb-4">★★★★★</div>
                  <p className="text-[14px] md:text-[15px] leading-[1.6] text-ink-2 mb-4 md:mb-5">{t.text}</p>
                  <div className="flex items-center gap-3 pt-3 md:pt-4 border-t border-line">
                    <div className={`${t.ph} w-9 h-9 rounded-full border border-line shrink-0`} />
                    <div className="leading-tight">
                      <div className="text-[13px] font-medium text-ink">{t.name}</div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-ink-4">{t.sub}</div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PARA SALÕES ── */}
      <section id="salons" className="border-b border-line" style={{ background: 'rgba(245,236,226,0.4)' }}>
        <div className="max-w-[1320px] mx-auto px-4 md:px-8 py-20 md:py-28 grid grid-cols-12 gap-6 md:gap-10 items-center">
          <div className="col-span-12 lg:col-span-7">
            <div className="font-mono text-[10.5px] uppercase tracking-widest text-brand mb-5 md:mb-6">// 06 · para salões</div>
            <h2 className="font-display font-medium leading-[1.02] text-ink mb-6 md:mb-8" style={{ fontSize: 'clamp(28px, 5vw, 56px)' }}>
              É dona de salão?<br />Você devia<br />estar <span className="font-serif italic font-normal text-brand">aqui dentro</span>.
            </h2>
            <p className="text-[16px] md:text-[18px] leading-[1.6] text-ink-2 max-w-[540px] mb-8 md:mb-10">
              Agenda integrada, comandas digitais, controle de combos, lembretes automáticos. Sem mensalidade fixa — só uma pequena taxa por agendamento confirmado.
            </p>

            <div className="grid grid-cols-2 gap-4 md:gap-6 max-w-[480px] md:max-w-[540px] mb-8 md:mb-10">
              {[
                { val: '−42%', label: 'no-shows' },
                { val: '+28%', label: 'retorno mensal' },
                { val: '14d', label: 'grátis para começar' },
                { val: '0', label: 'mensalidade fixa' },
              ].map(({ val, label }) => (
                <div key={label} className="border-t border-line pt-4">
                  <div className="font-display font-medium text-[24px] md:text-[28px] text-ink leading-none">{val}</div>
                  <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mt-2">{label}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <a href="mailto:contato@dauth.com.br" className="inline-flex h-[48px] md:h-[50px] items-center px-5 md:px-6 rounded-md text-[14px] md:text-[15px] font-medium bg-brand text-white hover:bg-[#743c22] transition-colors">
                Quero meu salão no Dauth
              </a>
              <a href="mailto:contato@dauth.com.br" className="inline-flex h-[48px] md:h-[50px] items-center px-5 md:px-6 rounded-md text-[14px] md:text-[15px] border border-line hover:bg-brand-soft transition-colors">
                Falar com a equipe
              </a>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-5 relative min-h-[480px] hidden lg:block">
            <div className="ph-warm-5 grain rounded-md aspect-[4/5] border border-line absolute right-0 top-0 w-[80%]" />
            <div className="absolute bottom-0 left-0 bg-bg border border-line rounded-md p-6 w-[280px] shadow-sm">
              <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4 mb-4">painel do salão</div>
              <div className="font-display font-medium text-[14px] text-ink mb-1">hoje · 12 agendamentos</div>
              <div className="text-[12px] text-ink-3 mb-4">próximo: Camila · 14h00</div>
              <div className="flex flex-col gap-1.5">
                {[
                  { color: 'bg-success', text: 'Mariana A. · coloração · 14h' },
                  { color: 'bg-success', text: 'Beatriz F. · corte · 15h30' },
                  { color: 'bg-gold', text: 'Helena R. · penteado · 17h' },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${item.color} shrink-0`} />
                    <span className="text-[11px] text-ink-2">{item.text}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-line font-mono text-[10.5px] uppercase tracking-widest text-brand">
                faturamento de hoje · R$ 2.840
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="border-b border-line">
        <div className="max-w-[1320px] mx-auto px-4 md:px-8 py-20 md:py-28 grid grid-cols-12 gap-6 md:gap-10">
          <div className="col-span-12 md:col-span-4">
            <div className="font-mono text-[10.5px] uppercase tracking-widest text-brand mb-5">// 07 · perguntas</div>
            <h2 className="font-display font-medium leading-[1.05] text-ink" style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}>
              Resposta<br />antes da <span className="font-serif italic font-normal text-brand">dúvida</span>.
            </h2>
            <p className="text-[14px] md:text-[15px] text-ink-3 mt-5 md:mt-6 leading-[1.6] max-w-[320px]">
              Não achou a sua? Manda mensagem — respondemos em minutos no horário comercial.
            </p>
          </div>

          <div className="col-span-12 md:col-span-8 divide-y divide-line border-y border-line">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group py-5 md:py-6 px-1 cursor-pointer">
                <summary className="flex justify-between items-center gap-4 md:gap-6">
                  <span className="font-display font-medium text-[16px] md:text-[19px] text-ink">{faq.q}</span>
                  <span className="font-mono text-[18px] md:text-[20px] leading-none text-ink-4 shrink-0 group-open:rotate-45 transition-transform inline-block">+</span>
                </summary>
                <p className="mt-4 md:mt-5 text-[14px] md:text-[15px] leading-[1.65] text-ink-2 pr-6 md:pr-10">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section id="acessar" className="border-b border-line">
        <div className="max-w-[1320px] mx-auto px-4 md:px-8 py-24 md:py-32">
          <div className="grid grid-cols-12 gap-6 md:gap-10 items-center">
            <div className="col-span-12 lg:col-span-7">
              <img src={logo} alt="Dauth" className="w-14 md:w-16 h-14 md:h-16 rounded-xl object-cover mb-6 md:mb-8 opacity-90" />
              <h2 className="font-display font-medium leading-[0.95] text-ink mb-6 md:mb-8" style={{ fontSize: 'clamp(48px, 7vw, 88px)' }}>
                Sua próxima<br />
                <span className="font-serif italic font-normal text-brand">visita</span> está<br />
                a um clique.
              </h2>
              <p className="text-[16px] md:text-[18px] leading-[1.55] text-ink-2 max-w-[480px] mb-8 md:mb-10">
                Acesse pelo navegador, descubra os salões parceiros aqui no RS e marque seu primeiro horário em menos de um minuto.
              </p>

              <div className="flex flex-wrap gap-3 mb-6 md:mb-8">
                <Link to="/register" className="inline-flex h-[52px] md:h-[58px] items-center gap-3 px-6 md:px-8 rounded-md bg-ink text-bg hover:bg-ink-2 transition-colors text-[14px] md:text-[15px] font-medium">
                  Criar conta grátis <ArrowRight />
                </Link>
                <Link to="/agendar" className="inline-flex h-[52px] md:h-[58px] items-center px-6 md:px-7 rounded-md text-[14px] md:text-[15px] border border-line hover:bg-brand-soft transition-colors">
                  Explorar sem cadastro
                </Link>
              </div>

              <div className="flex items-center gap-3 md:gap-4 text-[12px] md:text-[13px] text-ink-3 flex-wrap">
                <span className="font-mono text-[10.5px] uppercase tracking-widest">funciona em</span>
                {['celular', 'tablet', 'desktop'].map((d) => (
                  <span key={d} className="flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="4" y="1" width="6" height="12" rx="1" /></svg>
                    {d}
                  </span>
                ))}
              </div>
            </div>

            <div className="col-span-12 lg:col-span-5 relative min-h-[560px] hidden lg:block">
              <div className="absolute top-0 right-8 ph-warm-1 grain rounded-md w-[260px] aspect-[3/4] border border-line" />
              <div className="absolute top-32 left-0 ph-warm-2 grain rounded-md w-[220px] aspect-[4/5] border border-line" />
              <div className="absolute bottom-0 right-0 bg-bg border border-line rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-ink-2 shadow-sm">
                ★ 4.9 · clientes do rs
              </div>
              <div className="absolute top-12 left-32 bg-bg border border-line rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-ink-2 shadow-sm rotate-[8deg]">
                180+ salões no rs
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-bg">
        <div className="max-w-[1320px] mx-auto px-4 md:px-8 py-12 md:py-16 grid grid-cols-12 gap-6 md:gap-8">
          <div className="col-span-12 md:col-span-5">
            <div className="flex items-center gap-3 mb-4 md:mb-5">
              <img src={logo} alt="Dauth" className="w-9 md:w-10 h-9 md:h-10 rounded-lg object-cover" />
              <div className="leading-tight">
                <div className="font-display font-medium text-[20px] md:text-[22px] text-ink">Dauth</div>
                <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4 -mt-0.5">agendamentos</div>
              </div>
            </div>
            <p className="text-[13px] md:text-[14px] text-ink-3 leading-[1.6] max-w-[360px]">
              Plataforma web que conecta você aos melhores salões do Rio Grande do Sul — beleza marcada com calma, sem precisar caçar resposta no WhatsApp.
            </p>
          </div>

          <div className="col-span-6 md:col-span-2">
            <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4 mb-4">portal</div>
            <ul className="flex flex-col gap-2 text-[13px] md:text-[14px] text-ink-2">
              <li><a href="#como" className="hover:text-brand transition-colors">Como funciona</a></li>
              <li><a href="#servicos" className="hover:text-brand transition-colors">Serviços</a></li>
              <li><a href="#acessar" className="hover:text-brand transition-colors">Acessar</a></li>
              <li><Link to="/agendar" className="hover:text-brand transition-colors">Agendar agora</Link></li>
            </ul>
          </div>

          <div className="col-span-6 md:col-span-2">
            <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4 mb-4">conta</div>
            <ul className="flex flex-col gap-2 text-[13px] md:text-[14px] text-ink-2">
              <li><Link to="/login" className="hover:text-brand transition-colors">Entrar</Link></li>
              <li><Link to="/register" className="hover:text-brand transition-colors">Criar conta</Link></li>
              <li><Link to="/agendar" className="hover:text-brand transition-colors">Explorar serviços</Link></li>
            </ul>
          </div>

          <div className="col-span-12 md:col-span-3">
            <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4 mb-4">empresa</div>
            <ul className="flex flex-col gap-2 text-[13px] md:text-[14px] text-ink-2">
              <li><a href="mailto:contato@dauth.com.br" className="hover:text-brand transition-colors">Contato</a></li>
              <li><a href="mailto:contato@dauth.com.br" className="hover:text-brand transition-colors">Para salões</a></li>
              <li><Link to="/privacidade" className="hover:text-brand transition-colors">Política de Privacidade</Link></li>
              <li><Link to="/termos" className="hover:text-brand transition-colors">Termos de Uso</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-line">
          <div className="max-w-[1320px] mx-auto px-4 md:px-8 py-5 md:py-6 flex items-center justify-between flex-wrap gap-4">
            <div className="font-mono text-[10px] md:text-[10.5px] uppercase tracking-widest text-ink-4">
              © 2026 Dauth Agendamentos · feito com cuidado no Rio Grande do Sul
            </div>
            <div className="font-mono text-[10px] md:text-[10.5px] uppercase tracking-widest text-ink-4">v1.0 · beta</div>
          </div>
        </div>
      </footer>

    </div>
  )
}
