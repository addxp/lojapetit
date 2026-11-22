# Gestão de Loja de Roupas

Sistema web de gestão e vendas: Next.js (App Router) + TypeScript + Tailwind CSS + Supabase (PostgreSQL, Auth, Storage) + Recharts + Lucide.

## Funcionalidades

- Login com Supabase Auth (rotas protegidas por middleware)
- Dashboard com filtros (hoje, ontem, 7 e 30 dias, personalizado), gráficos e alertas de estoque
- Produtos com categorias, linhas, imagem e variações (tamanho × cor, cada uma com seu estoque)
- Estoque: posição, ajustes manuais, histórico de movimentações, compras/reposição com custo histórico
- Vendas (PDV): carrinho, desconto (R$ ou %), Dinheiro, Pix, Crédito, Débito, Fiado e pagamento dividido
- Consulta, cancelamento e devolução (parcial ou total) de vendas, com ajuste de estoque e financeiro
- Relatórios diário, por tamanho, categoria, linha e produto, com exportação em PDF e Excel
- Financeiro: resultado, despesas, contas a receber (fiado), fechamento de caixa
- Clientes e fornecedores com histórico



## Como o sistema calcula

- **Faturamento (receita líquida)** = vendas − devoluções, sem vendas canceladas.
- **Lucro bruto** = receita líquida − custo das mercadorias vendidas (custo unitário gravado no momento da venda).
- **Resultado operacional** = lucro bruto − despesas.
- **Custo médio**: a cada compra registrada, o custo do produto é recalculado pela média ponderada. O custo pago em cada compra fica no histórico (`purchase_items`).
- **Fiado**: a venda fica "pendente" até o recebimento total. Receber fiado entra no caixa na data do recebimento.
- **Fechamento de caixa**: dinheiro esperado = pagamentos em dinheiro do período − despesas pagas em dinheiro. Não considera troco inicial.

## Integridade dos dados

Finalizar, cancelar e devolver venda, registrar compra, ajustar estoque e receber fiado são funções PostgreSQL (RPC) executadas em uma única transação, com bloqueio de linha nas variações. O estoque tem `CHECK (stock >= 0)`, então nenhuma venda concorrente consegue deixá-lo negativo.


## Limitações conhecidas

- Listas de estoque e de produtos carregam até 300–500 itens por consulta; use a busca para refinar.
- Produtos não são excluídos, apenas inativados, para preservar o histórico.
