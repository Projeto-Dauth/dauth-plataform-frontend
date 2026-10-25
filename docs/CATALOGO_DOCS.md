# Catálogo do Docs (aba "Docs" do app) — 2026-10-16

Ponto de entrada da documentação de uso. Cada tópico liga **texto** (`src/content/docs/<role>/<slug>.md`), **tela** e **vídeo** (`e2e-demo/`).

- Infra: `src/pages/shared/DocsPage.jsx`, rota `/:salonSlug/docs`, item "Docs" no menu de Admin e Profissional, teste `e2e/docs.spec.js`.
- Textos copiados do produto de referência (julho/2026) e **ainda não revisados**; imagens (`public/docs-images/`) também são do produto antigo e serão trocadas por capturas dos vídeos.
- Status: **OK** (confere com o app) · **ATUALIZAR** (existe, mas defasado) · **NOVO** (não existe ainda).

## Admin

| Tópico (slug) | Tela | Status | O que falta / está errado | Vídeo |
|---|---|---|---|---|
| dashboard | `admin/dashboard` | OK | Conferir nomes dos cartões (Ticket médio, Cancelamentos). | admin-dashboard |
| agenda | `admin` | ATUALIZAR | Recorrência semanal e cancelar série; assistente por serviço; atendimento combinado (2+ profissionais); folga parcial/total; bloqueios do agendamento online. | admin-agenda |
| agendamentos | `admin/agendamentos` | ATUALIZAR | Editar serviços do agendamento; cancelar série recorrente; ações em grupo. | admin-agendamentos |
| clientes | `admin/usuarios` | ATUALIZAR | "Cliente desde"; ajustar crédito do cliente; convidar para a equipe; quitação fica em **Mensalistas** (não em Clientes). **Feito no .md (2026-10-24):** telefone só leitura e "Redefinir senha" por link no WhatsApp. O vídeo `admin-clientes` não mostra isso. | admin-clientes |
| servicos | `admin/servicos` | ATUALIZAR | Comissão sugerida da assistente; preço/comissão por profissional; selo "Comissão pendente"; limite por conta de serviço. | admin-servicos |
| pacotes | `admin/combos` | ATUALIZAR | Preço e comissão obrigatórios por item e soma = preço do pacote; aba **Pacotes vendidos**; concluir manualmente (com motivo); cancelar venda não paga; plano Profissional+. **Feito no .md (2026-10-24):** Valor/sessão × quantidade = preço (com exemplo) e a opção de o Profissional vender (Configurações → Pagamentos). | admin-pacotes |
| convidar-profissional | `admin/convidar-profissional` | ATUALIZAR | Virou "Profissionais": lista de convites (reenviar/cancelar), uso do plano (vagas), aceite pelo link com confirmação por WhatsApp, **contas de serviço**, remover = desativar. | admin-convidar-profissional |
| caixa | `admin/caixa` | ATUALIZAR | Nome "Mensalista" (não "Fiado"); pagamento dividido; valor recebido e troco que vira crédito; crédito do cliente; serviço/produto avulso no Fechar conta; excluir comanda; formas aceitas pelo salão. | admin-caixa |
| mensalistas | `admin/mensalistas` | **NOVO** | Fiado em aberto, quitar com forma real de pagamento, comissão só sai ao quitar. | — |
| comissoes | `admin/comissoes` | ATUALIZAR | Papel Assistente; forma de pagamento do repasse no Histórico; período no fuso do salão; comissão "via pacote". | admin-comissoes |
| produtos | `admin/produtos` | ATUALIZAR | Plano Profissional+; pedido pago entra no financeiro e baixa estoque; Mensalista; preço editável só encomendado. | admin-produtos |
| pedidos-produtos | `admin/pedidos-produtos` | **NOVO** | Hoje está misturado em "Produtos". | — |
| configuracoes | `admin/configuracoes` | **NOVO** | 6 abas: Geral (fuso, paleta, código de acesso), Agendamento, Pagamentos, Página pública ("Em breve"), WhatsApp, Plano. | — |
| planos | Configurações → Plano / paywall | **NOVO** | Trial 7 dias, upgrade por PIX, limites por plano, o que bloqueia quando acaba. | — |
| permissoes | ficha do profissional/conta de serviço | **NOVO** | Módulos liberados por pessoa; Admin sempre total. | — |
| meus-saloes | `/meus-saloes` | **NOVO** | Entrar no salão, "Tenho um código", Trocar salão, criar/arquivar/excluir salão. | — |
| meus-servicos-horarios | `admin/meus-servicos`, `admin/meus-horarios` | OK | Só ajustar nomes das rotas. | admin-meus-servicos-horarios |
| notificacoes | sino | OK | Conferir tipos (comissão pendente, avise os clientes). | admin-notificacoes |
| perfil | `perfil` | ATUALIZAR | Troca de telefone com confirmação por WhatsApp; senha; "Exportar meus dados" (existe). | admin-perfil |

## Profissional

| Tópico (slug) | Tela | Status | O que falta | Vídeo |
|---|---|---|---|---|
| agenda | `profissional` | ATUALIZAR | Mesmos itens da Agenda do Admin (recorrência, assistente). | — |
| agendamentos | `profissional/agendamentos` | ATUALIZAR | Idem Agendamentos. | — |
| comandas | `profissional/comandas` | ATUALIZAR | Mensalista, pagamento dividido, crédito. | — |
| produtos | `profissional/produtos`, `profissional/pedidos-produtos` | ATUALIZAR | Plano; permissões. | — |
| pacotes | `profissional/combos` | **NOVO** (.md feito 2026-10-24) | Só aparece quando o Admin liga "Venda de pacotes"; vende, não cria/edita. | — |
| comissoes | `profissional/comissoes` | ATUALIZAR | Papel Assistente; "via pacote". | — |
| servicos-horarios | `profissional/servicos`, `profissional/horarios` | OK | Nomes das rotas. | — |
| notificacoes / perfil | — | OK / ATUALIZAR | Telefone com confirmação. | — |
| modulos-bloqueados | menu | **NOVO** | O que fazer quando um módulo está bloqueado. | — |

## Cliente (hoje sem seção no Docs; o Docs só abre para Admin e Profissional)

| Tópico | Tela | Status | Vídeo |
|---|---|---|---|
| agendar | `/:slug/agendar` | **NOVO** | — |
| entrar-por-codigo | `/meus-saloes` | **NOVO** | — |
| meus-agendamentos, combos, comandas | `cliente/*` | **NOVO** | — |

Decisão pendente: abrir o Docs também para o Cliente (rota `docs` hoje só aceita Admin e Profissional).

## Vídeos (`e2e-demo/`) — refeitos em 2026-10-17

**Regra:** um vídeo curto (**até ~30 s**) por aba do Docs, **sem áudio**, com a **legenda gravada na imagem** (não existe `.vtt`/`.srt` para subir). Os vídeos antigos `01`–`09` (longos, por fluxo) foram substituídos e não são mais usados pelo Docs.

- Roteiros: `e2e-demo/admin-docs.spec.js` (um `docVideo({...})` por aba do Admin). Helper: `e2e-demo/support/doc.js`. Kit de gravação (cursor, legenda, ffmpeg): `e2e-demo/support/kit.js`.
- Saída: `demo-output/mp4/admin-<slug>.mp4` (+ `webm/`). `demo-output/duracoes.txt` registra a duração de cada gravação. O teste **falha se passar de 32 s**.
- Ligação com o Docs: `src/content/docs/videos.json` (`{ Admin: { <slug>: "admin-<slug>" } }`) → `DocsPage.jsx` toca `${VITE_DOCS_VIDEOS_URL}/admin-<slug>.mp4`. Sem a variável, o Docs mostra só o texto.
- Hospedagem: Cloudflare R2, bucket **público e plano** (os `.mp4` na raiz). Em produção: domínio próprio no bucket (ex.: `videos.dauth.com.br`) e `VITE_DOCS_VIDEOS_URL` na Vercel (o Vite embute no build: depois de mudar, novo deploy). Não precisa de CORS (não há mais `<track>` de legenda).

| Aba (Admin) | Arquivo | Duração |
|---|---|---|
| Dashboard | admin-dashboard | 26,5 s |
| Agenda | admin-agenda | 29,3 s |
| Agendamentos | admin-agendamentos | 25,7 s |
| Clientes | admin-clientes | 25,5 s |
| Serviços e Categorias | admin-servicos | 29,3 s |
| Pacotes | admin-pacotes | 24,2 s |
| Convidar profissional | admin-convidar-profissional | 30,8 s |
| Caixa | admin-caixa | 29,4 s |
| Comissões | admin-comissoes | 26,4 s |
| Produtos e Pedidos | admin-produtos | 31,8 s |
| Meus serviços e horários | admin-meus-servicos-horarios | 25,7 s |
| Notificações | admin-notificacoes | 13,6 s |
| Meu perfil | admin-perfil | 23,0 s |

Pacotes e Produtos são **resumos**: mostram o começo do cadastro (drawer) e explicam o resto na legenda; não salvam o pacote nem criam o pedido.

**Falta:** vídeos do Profissional (plano abaixo, em "Pendente") e do Cliente (o Docs ainda não abre para Cliente). Tópicos NOVOS do catálogo sem vídeo: mensalistas, pedidos-produtos (só citado em Produtos), configuracoes, planos, permissoes, meus-saloes.

### Pendente: vídeos do Profissional (fazer depois)

Mesmo formato do Admin (≤30 s, sem áudio, legenda na imagem). A infra já aceita: `docVideo({ role: 'profissional', ... })` loga como `SEED_USERS.profissional` (Profissional 1, telefone `(11) 9 9999-0002`) e usa `base = /<slug>/profissional`; o arquivo sai como `profissional-<slug>.mp4`.

**Passo a passo**
1. Criar `e2e-demo/profissional-docs.spec.js` (copiar a estrutura do `admin-docs.spec.js`, `role: 'profissional'`).
2. Gravar uma aba por vez com `-g` e conferir `demo-output/duracoes.txt` (limite 32 s).
3. Preencher em `src/content/docs/videos.json` a chave `"Profissional"`: `{ "<slug>": "profissional-<slug>" }` (hoje a chave não existe; o `DocsPage` lê `videos[role]?.[slug]`, então ela pode ser criada sem mexer no código).
4. Enviar os `.mp4` ao R2, na raiz do bucket, junto com os do Admin.
5. Atualizar a coluna "Vídeo" da tabela Profissional deste catálogo e a seção de durações.

**Roteiro sugerido (8 abas do `profissional/index.json`)** — rotas e nomes de menu conferidos em `src/config/navItems.js`:

| Slug | Tela | O que mostrar (ideia de legendas curtas) |
|---|---|---|
| agenda | `profissional` | "Sua agenda mostra só os seus horários" → clicar num horário livre → cliente e serviço → confirmar. Reaproveitar o fluxo da Agenda do Admin (`Agendar HH:MM com Profissional 1`). |
| agendamentos | `profissional/agendamentos` | Lista só dos seus atendimentos; busca por cliente (usa `client_name`, já corrigido); abas Ativos/Concluídos/Cancelados. |
| comandas | `profissional/comandas` | Comandas dos seus atendimentos; abrir uma em aberto (Cliente 9 e 10 são do Profissional 1 em `dados.js`); forma de pagamento. Só aparece se o módulo Caixa estiver liberado para ele. |
| produtos | `profissional/produtos` + `profissional/pedidos-produtos` | Plano Profissional+; sem produtos no seed: criar um antes via banco/API ou só mostrar a tela vazia com legenda. Sujeito a permissão do módulo Produtos. |
| comissoes | `profissional/comissoes` | "Minhas comissões": a receber e já repassadas. O seed (`dados.js`) já tem atendimentos pagos do Profissional 1 (Clientes 12 e 13). |
| servicos-horarios | `profissional/servicos`, `profissional/horarios` | Mesmo roteiro de "Meus horários" do Admin (Adicionar → início/fim → Salvar) e a lista de serviços vinculados (o Profissional 1 faz Serviços 1–4; quem vincula é o Admin). |
| notificacoes | sino | Igual ao do Admin. |
| perfil | `/<slug>/perfil` (fora do prefixo `profissional`) | Igual ao do Admin; no `open`, usar `/${slug}/perfil`. |

**Cuidados**
- Cada execução do Playwright zera o banco, então os vídeos de Comandas e Comissões são independentes entre si **se rodados em invocações separadas**. Se rodar o arquivo inteiro numa execução só, uma aba que paga a comanda ou repassa a comissão muda os dados da seguinte (o mesmo vale para o Admin).
- O menu do Profissional some itens conforme as permissões por módulo (`ROLE_MODULES`, `produto/config/modules.js`); no seed ele tem tudo liberado, mas conferir se a tela aparece antes de escrever o roteiro.
- Lembrar que o Docs só abre para Admin e Profissional; os vídeos do Cliente dependem da decisão pendente de abrir o Docs para o Cliente (ver "Cliente" acima).

### Como gravar
```bash
cd plataforma/frontend
npx playwright test -c playwright.demo.config.js e2e-demo/admin-docs.spec.js                 # os 13
npx playwright test -c playwright.demo.config.js e2e-demo/admin-docs.spec.js -g "Caixa"      # só um (o -g ignora maiúsculas: "Serviços" pega também "Meus serviços…")
```
- Sobe backend 3100 + front 5183 com banco zerado e dados genéricos (`support/dados.js`: "Salão Exemplo", Profissional 1..3, Cliente 1..N). **Precisa de `ffmpeg`/`ffprobe` no PATH.**
- **Mesmas portas e mesmo `e2e.db` dos testes E2E** (`npm run test:e2e`): não rodar os dois ao mesmo tempo (a 2ª execução falha com "port already used" ou o seed quebra com `P2002`).
- Legenda: `DEMO_BURN_CAPTIONS=0` grava sem legenda na imagem (o `.srt`/`.txt` sai em `demo-output/legendas/` de qualquer jeito). Ritmo da legenda: ~18 caracteres/s (`speechSeconds` em `kit.js`).
- Para ficar dentro dos 30 s: poucas legendas curtas, `typeQuick`/`pickQuick` (em vez de `typeSlow`/`pickSlow`), e as ações rodam junto com a legenda. Cada `say` espera a anterior terminar, então a soma das legendas é o piso da duração.
- Convidar profissional usa um salão só dele (`prepare` do `docVideo`), porque o Salão Exemplo já tem as 3 vagas do trial ocupadas.
- Drawer aberto bloqueia cliques no fundo e **Esc não fecha**; para ir a outra aba depois de abrir um drawer, navegar pela URL (ex.: `/combos?view=vendidos`).

### Enviar ao R2
Enviar só os `demo-output/mp4/admin-*.mp4` para a raiz do bucket (`rclone sync` ou `wrangler r2 object put <bucket>/admin-caixa.mp4 --file ... --content-type video/mp4`).
