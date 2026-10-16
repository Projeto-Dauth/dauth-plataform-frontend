# Relatório de 15/10/2026 — Frontend

Sessão em que o marketplace e as telas de detalhe do salão saíram da versão beta, **"Meus salões"** virou a tela única de entrada para todos os papéis, o vínculo com o salão passou a ser por **código de acesso**, e o menu e as telas de acesso ganharam ajustes (logo, "Cliente desde", Trocar salão para o cliente). As regras e rotas do servidor estão em `backend/docs/RELATORIO_2026-10-15.md`.

## 1. Fluxo novo de entrada

```
login → /meus-saloes (todos: cliente, profissional, conta de serviço, Admin e dono)
        ├─ sem nenhum vínculo → "Você ainda não tem vínculo com nenhum salão" + campo do código
        ├─ convites da equipe pendentes no topo (Aceitar / Recusar)
        ├─ cartão de cada salão → Entrar → /:slug/(admin|profissional|cliente)
        ├─ "Tenho um código" → digita → vê o nome do salão → "Sim, entrar" / "Não é esse"
        └─ cliente: "Sair do salão" (com confirmação)
```

- **Login sempre cai em `/meus-saloes`** (antes: dono em Meus salões, profissional em Meus empregos, cliente no Marketplace). Depois do login vale também `?redirect=`.
- **Dupla confirmação do código:** o campo `XXXX-XXXX` tem máscara (maiúsculas, hífen automático, aceita colar minúsculas/sem hífen); "Continuar" consulta o servidor e mostra o nome e o endereço do salão antes de vincular.
- **O código nunca aparece** para cliente ou profissional; só o Admin o vê (Configurações → Geral).

## 2. Telas e componentes

### Novos
| Arquivo | Para quê |
|---------|----------|
| `components/salon/SalonCard.jsx` | Cartão reutilizável das 4 visões: nome, endereço, papel e botão **Entrar** (`aria-label="Entrar em <salão>"`). Espaços opcionais para a situação do plano (só Admin) e ações do vínculo. |
| `components/salon/JoinByCodeModal.jsx` | `JoinByCodeForm` (usado inline no estado vazio) e `JoinByCodeModal` (digita → confirma). |
| `components/layout/SalonSwitcher.jsx` | "Trocar salão", extraído do `Sidebar`. Lista os outros salões, "Adicionar com código" e "Meus salões". Aparece no menu do salão (ícone) **e no menu do cliente** (linha com texto). |
| `lib/enterSalon.js` | Entrar num salão (fonte única): grava no store, carrega papel e permissões, navega. Substituiu três cópias (Meus salões, Meus empregos e Trocar salão). |
| `lib/joinCode.js` | Máscara e validação do código. |

### Alterados (principais)
- **`pages/platform/MeusSaloesPage.jsx`** — reescrita como tela única. O dono mantém "Novo salão", as abas Ativos/Arquivados/Excluídos e arquivar/excluir/cancelar exclusão; só o Admin vê a situação do plano (trial, ativo…). Salão arquivado/excluído só aparece para o Admin.
- **`pages/admin/AdminConfiguracoes.jsx`** — card **"Código de acesso"** na aba Geral (copiar e "Gerar novo código", com confirmação e aviso quando o salão não aceita código); aba **"Página pública"** com selo **"Em breve"** e só um aviso (os valores salvos de Instagram/equipe/horário ficam no banco); **"Mostrar preços"** passou para a aba Agendamento (vale para o `/agendar`).
- **`components/layout/ClienteSidebar.jsx`** — "Cliente desde *mês de ano*" (data em que entrou no salão; cache por salão) e "Trocar salão".
- **`pages/cliente/MeusCombos.jsx`** — tinha uma **cópia própria e desatualizada** do menu do cliente ("cliente" em minúsculo, sem Trocar salão); passou a usar o `ClienteSidebar` compartilhado.
- **`pages/admin/AdminUsuarios.jsx`** — a ficha do cliente mostra "Cliente desde *mês de ano*".
- **`lib/format.js`** — `formatMonthYear`.
- **Logo do Dauth** no lugar do quadrado com "D" em: Meus salões, Login (painel e mobile), Cadastro (painel e mobile), Criar salão, Confirmar email, Confirmar telefone, Verificar telefone e Minha conta.
- **`router/index.jsx`**, `LoginPage`, `NaoAutorizado`, `PaywallScreen`, `SalonLayout`, `AcceptInvitePage`, `AgendarPage`, `MinhaContaPage`, `ClienteSidebar`, `PendingInvitations`, `platformApi` — referências a `/marketplace`, `/salao/:slug` e `/meus-empregos` removidas ou redirecionadas para `/meus-saloes`. Rota pública de salão inexistente (`/:slug/agendar`) mostra a página 404.

### Removidos
`MarketplacePage`, `SalaoPublicPage`, `MeusEmpregosPage` e `PortalPage` (página de divulgação com texto de "curadoria"); rotas `/marketplace`, `/salao/:slug`, `/meus-empregos` e `/:slug/portal`; `portal` saiu das rotas públicas do `SalonLayout`.

## 3. Testes E2E (Playwright)

**124 testes em 35 arquivos.**

- **Novos:**
  - `vinculo-por-codigo.spec.js` — código válido com dupla confirmação, "Não é esse", código inexistente e incompleto, código só visível ao Admin (cliente e profissional recebem 403), gerar novo código sem desvincular ninguém e recusar o antigo, recusa de salão suspenso / aguardando pagamento / trial vencido / arquivado / com exclusão agendada, cliente sai e volta (e é barrado com agendamento em aberto), profissional e Admin não saem, profissional removido não volta por código, cliente troca de salão pelo menu, rate limit (429), e o menu "Cliente desde" em todas as telas (inclusive a ficha do Admin).
  - `agendamento-precos.spec.js` — "Mostrar preços" no link de agendamento, dados públicos mínimos por slug (a listagem do marketplace não existe) e página 404.
  - `profissional-desativado.spec.js` — remover profissional desativa agenda, listas, serviços e agendamento online; cancela só o futuro em aberto; histórico e comissão ficam.
  - Em `configuracoes.spec.js` (aba "Em breve") e em `comissoes-repasse.spec.js` (pagamento às 23h30 de Brasília entra no dia e no mês).
- **Removidos:** `marketplace-trial.spec.js`, `pagina-publica.spec.js`.
- **Ajustados:** `login`, `cadastro-cliente`, `conta`, `conta-servico`, `convite-equipe`, `equipe-plano` (destino agora é `/meus-saloes`; o botão de entrar é `Entrar em <salão>`).
- **Helpers:** `e2e/support/salon.js` ganhou `joinCodeOf`, `joinByCode` e `lookupCode`.
- **Correção de teste:** `pacote-regras › cancelar a venda` clicava antes de a busca (feita no servidor) filtrar a lista e falhava só na suíte inteira (4 botões "Cancelar venda" casavam). Agora espera a lista ficar com 1 botão; passou 5/5.
- **Resultado:** a suíte completa rodou duas vezes durante o dia: 118/120 (as 2 falhas eram o bug de fuso das comissões, já corrigido no backend) e 122/123 (a falha era o teste instável acima). **Depois disso não foi reexecutada inteira**; o teste do menu "Cliente desde", a troca de logos e a correção do teste de pacote foram cobertos só por execuções parciais (24/24 e 8/8).

## 4. Bug real achado pelos testes

"Gerar novo código" mandava corpo `null` (`platformApi.post(url, null, …)`) e o Express respondia 500 (`entity.parse.failed`). O front passou a mandar `{}`.

## 5. Para publicar (Vercel)

- O build do front compila sem erros (`npx vite build`); nenhuma variável nova.
- O front depende do backend novo: as rotas `by-code`, `join-by-code`, `join-code/regenerate` e `leave`, e `joinCode` em `/salon/config`. Publicar o backend **antes** (ver `backend/docs/RELATORIO_2026-10-15.md`).
- Links antigos `/marketplace`, `/salao/:slug` e `/meus-empregos` deixam de existir (decisão do dono: não há links circulando).

## 6. Pendências

- Nenhuma tela desta sessão foi vista por mim no navegador; o dono testou parte e disse que está tudo certo.
- Se o contraste da logo sobre o fundo da cor da marca (painéis laterais do login e do cadastro) não agradar, é um ajuste simples.
- Melhoria opcional: indicador de carregamento na busca de "Pacotes vendidos" (a lista antiga fica visível por um instante enquanto o filtro chega).
