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

## Requisitos

- Node.js 18.18+ (recomendado 20+)
- Conta gratuita no [Supabase](https://supabase.com)

## 1. Configurar o Supabase

1. Crie um projeto em supabase.com.
2. Abra **SQL Editor**, cole todo o conteúdo de `supabase/schema.sql` e execute. O script cria tabelas, índices, restrições, funções transacionais, políticas RLS, o bucket de imagens `product-images` e as categorias/linhas iniciais. Pode ser executado de novo sem perder dados.
3. Em **Authentication → Users**, clique em **Add user** e crie o usuário (e-mail + senha) que acessará o sistema.
4. Em **Authentication → Sign In / Providers → Email**, desative **Allow new users to sign up** (recomendado). As políticas RLS dão acesso total a qualquer usuário autenticado, então ninguém além dos usuários criados por você deve conseguir se cadastrar.
5. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**.

## 2. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-publica
NEXT_PUBLIC_STORE_NAME=Nome da sua loja
```

## 3. Rodar localmente

```bash
npm install
npm run dev
```

Acesse http://localhost:3000 e entre com o usuário criado no passo 1.3.

Para produção: `npm run build && npm start` (ou publique na Vercel configurando as mesmas variáveis).

## Como o sistema calcula

- **Faturamento (receita líquida)** = vendas − devoluções, sem vendas canceladas.
- **Lucro bruto** = receita líquida − custo das mercadorias vendidas (custo unitário gravado no momento da venda).
- **Resultado operacional** = lucro bruto − despesas.
- **Custo médio**: a cada compra registrada, o custo do produto é recalculado pela média ponderada. O custo pago em cada compra fica no histórico (`purchase_items`).
- **Fiado**: a venda fica "pendente" até o recebimento total. Receber fiado entra no caixa na data do recebimento.
- **Fechamento de caixa**: dinheiro esperado = pagamentos em dinheiro do período − despesas pagas em dinheiro. Não considera troco inicial.

## Integridade dos dados

Finalizar, cancelar e devolver venda, registrar compra, ajustar estoque e receber fiado são funções PostgreSQL (RPC) executadas em uma única transação, com bloqueio de linha nas variações. O estoque tem `CHECK (stock >= 0)`, então nenhuma venda concorrente consegue deixá-lo negativo.

## Estrutura

```
supabase/schema.sql          banco, funções e RLS
src/middleware.ts            proteção de rotas
src/lib/                     cliente Supabase, formatação, exportação
src/components/              UI compartilhada, providers (toast/confirmação), sidebar
src/app/login                login
src/app/(app)/               dashboard, vendas, produtos, estoque, relatórios,
                             financeiro, clientes, fornecedores
```

## Limitações conhecidas

- Modelo de loja única: todo usuário autenticado tem o mesmo nível de acesso (sem perfis/permissões).
- Listas de estoque e de produtos carregam até 300–500 itens por consulta; use a busca para refinar.
- Produtos não são excluídos, apenas inativados, para preservar o histórico.
- O código foi escrito sem execução de `npm install`/`build` no ambiente de geração; rode `npm run build` e corrija eventuais ajustes de tipagem.
