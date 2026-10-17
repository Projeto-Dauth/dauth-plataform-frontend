# Caixa

O Caixa é onde o dinheiro entra: fechamento de comandas de serviços, vendas de produtos e o relatório financeiro.

## Aba Comandas

Uma comanda é aberta automaticamente quando um atendimento é registrado.

![Painel de fechamento de comanda com seletor de método de pagamento incluindo Fiado](/docs-images/admin-caixa.webp)

### Fechar uma comanda

1. Veja todas as comandas em aberto na lista.
2. Clique em uma para abrir o painel de pagamento.
3. Escolha o método: **dinheiro**, **cartão**, **pix** ou **Fiado — cobrar depois**.
4. Confirme.

Se o cliente tiver **2 ou mais comandas em aberto**, elas aparecem agrupadas em "Contas em aberto" com um botão para fechar tudo de uma vez (inclui produtos pendentes daquele cliente no mesmo fechamento).

![Painel de fechamento de multiplas comandas com seletor de método de pagamento incluindo Fiado](/docs-images/fechar-comanda.webp)

A tela de fechamento mostra toda a conta do cliente numa lista só — cada linha com Serviço, Profissional, Dia e Hora, mesmo que os itens venham de atendimentos diferentes ou de profissionais diferentes no mesmo horário. Produtos aparecem sempre por último, num bloco separado, já que não têm profissional/horário próprios. O botão "x" ao lado de cada linha remove aquele item do fechamento sem perder o resto — útil quando o cliente quer pagar só parte da conta agora.

### Fiado / Mensalista

Ao escolher **Fiado — cobrar depois**, a comanda é marcada como paga no sistema, mas sem cobrança imediata — o valor fica registrado como pendência do cliente. Para quitar depois, veja a página **Clientes**, filtro **Mensalistas**.

## Aba Produtos

Pedidos de produtos vendidos (shampoo, cosméticos, etc.) aparecem aqui para pagamento, com o mesmo seletor de método (incluindo fiado).

## Aba Relatório

Pagamentos recebidos no período selecionado (De/Até), somados por método de pagamento.

## Quitar fiado (mensalistas)

A quitação de fiado pendente não fica no Caixa — fica na página **Clientes** (`/admin/usuarios`). O chip **Mensalistas** filtra os clientes com fiado em aberto; clicar em um cliente abre o painel com a seção "Mensalidade pendente", listando os itens e permitindo quitar com um método real de pagamento.
