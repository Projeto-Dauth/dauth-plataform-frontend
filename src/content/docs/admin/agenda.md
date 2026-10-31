# Agenda

A Agenda é a tela principal do dia a dia — mostra os horários de todos os profissionais lado a lado, por dia.

![Grade da Agenda com profissionais lado a lado, blocos coloridos por status e agendamento urgente em destaque](/docs-images/admin-agenda.webp)

## 1. Navegar pela Agenda

- Use as **setas** no topo para ir para o dia anterior/seguinte.
- O ícone de **calendário** abre um seletor de data para pular direto para um dia específico.
- O botão **Hoje** volta para a data atual.
- No celular, a tela mostra um profissional por vez — use as setas para trocar entre eles.

## 2. Criar um agendamento

Clique em um horário vazio na grade do profissional desejado e preencha:

| Campo | Obrigatório? | O que é |
|---|---|---|
| **Cliente** | Sim | Busca por nome, ou cadastre um cliente novo na hora |
| **Serviço** | Sim | Pode adicionar mais de um serviço no mesmo agendamento, inclusive com profissionais diferentes — o horário do próximo é calculado automaticamente para cada profissional |
| **Horário de início e fim** | Sim | Preenchido automaticamente pela duração do serviço, mas editável |
| **Urgente** | Não | Encaixa o agendamento mesmo que já exista outro no mesmo horário para a mesma profissional (útil para clientes de última hora). **Se for a mesma cliente** que já tem um atendimento em andamento com essa profissional (ex: coloração agindo enquanto ela faz a manicure), o sistema junta os dois automaticamente num atendimento só — não vira dois agendamentos separados brigando por espaço na grade |

## 3. Ações em um agendamento existente

Clique com o botão direito (ou toque e segure no celular) sobre o bloco do agendamento para abrir o menu de opções:

- **Marcar como Confirmado / Concluído / Cancelado** — dependendo do status atual.
- **Editar** — abre um painel para alterar data, horários e até os serviços do agendamento. Pode adicionar mais serviços para a mesma profissional a qualquer momento — inclusive com horário sobreposto ao que já existe (útil para o caso de "produto agindo enquanto faz outro serviço"): o serviço novo entra no mesmo agendamento, sem virar um card separado na Agenda. Só disponível enquanto o status for Pendente ou Confirmado — depois de Concluído ou Cancelado não dá mais para editar, para não desalinhar comandas e comissões já geradas.
- **Abrir comanda** — leva direto para o Caixa com a comanda daquele cliente selecionada.
- **Fechar comanda** — disponível só depois que o atendimento foi marcado como Concluído; abre o fechamento de conta direto pela Agenda.
- **Ver detalhes** — abre a página completa do agendamento.

## Cores dos blocos

| Status | Cor |
|---|---|
| Pendente | Azul |
| Confirmado | Verde |
| Concluído | Dourado |
| Cancelado | Vermelho riscado |
| Urgente | Mesma divisão de espaço que qualquer sobreposição — identificado só pela borda destacada e o aviso "⚡ Urgente", nunca escondendo outro agendamento por baixo |

## 4. Cadastrar uma folga

1. Clique no botão **+ Folga**.
2. Escolha o profissional, a data e se é o dia inteiro ou só um intervalo.

A folga aparece como um bloco vermelho na grade e bloqueia novos agendamentos naquele intervalo. Clique com o botão direito na folga para removê-la.
