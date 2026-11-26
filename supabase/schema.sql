-- =====================================================================
-- Sistema de gestão para loja de roupas — schema PostgreSQL (Supabase)
-- Execute este arquivo inteiro no SQL Editor do Supabase.
-- É idempotente: pode ser executado novamente sem apagar dados.
-- =====================================================================

-- ---------- Cadastros básicos ----------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  contact text,
  products_supplied text,
  created_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  phone text,
  created_at timestamptz not null default now()
);

-- ---------- Produtos e variações ----------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text,
  category_id uuid references categories(id) on delete set null,
  collection_id uuid references collections(id) on delete set null,
  image_url text,
  cost_price numeric(12,2) not null default 0 check (cost_price >= 0),   -- custo médio atual
  sale_price numeric(12,2) not null default 0 check (sale_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists products_category_idx on products(category_id);
create index if not exists products_collection_idx on products(collection_id);
create index if not exists products_name_idx on products(lower(name));

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  size text not null default 'Único' check (length(trim(size)) > 0),
  color text not null default '',
  stock integer not null default 0 check (stock >= 0),          -- nunca negativo
  min_stock integer not null default 2 check (min_stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, size, color)
);
create index if not exists variants_product_idx on product_variants(product_id);
create index if not exists variants_stock_idx on product_variants(stock);

-- ---------- Compras / reposição ----------
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers(id) on delete set null,
  purchase_date date not null default current_date,
  notes text,
  total numeric(12,2) not null default 0 check (total >= 0),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists purchases_supplier_idx on purchases(supplier_id);
create index if not exists purchases_date_idx on purchases(purchase_date);

create table if not exists purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  variant_id uuid not null references product_variants(id),
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12,2) not null check (unit_cost >= 0)       -- histórico do custo pago
);
create index if not exists purchase_items_purchase_idx on purchase_items(purchase_id);
create index if not exists purchase_items_variant_idx on purchase_items(variant_id);

-- ---------- Movimentações de estoque ----------
create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references product_variants(id),
  type text not null check (type in ('entrada','compra','venda','ajuste','devolucao','cancelamento')),
  quantity integer not null check (quantity <> 0),               -- positivo entra, negativo sai
  balance_after integer not null check (balance_after >= 0),
  unit_cost numeric(12,2),
  reference_id uuid,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists movements_variant_idx on stock_movements(variant_id, created_at desc);
create index if not exists movements_created_idx on stock_movements(created_at desc);

-- ---------- Vendas ----------
create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  status text not null default 'concluida' check (status in ('concluida','pendente','cancelada')),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null check (total >= 0),
  cost_total numeric(12,2) not null default 0 check (cost_total >= 0),
  profit numeric(12,2) not null default 0,                       -- lucro bruto no momento da venda
  amount_pending numeric(12,2) not null default 0 check (amount_pending >= 0),
  refunded_total numeric(12,2) not null default 0 check (refunded_total >= 0),
  notes text,
  canceled_at timestamptz,
  cancel_reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists sales_created_idx on sales(created_at desc);
create index if not exists sales_status_idx on sales(status);
create index if not exists sales_customer_idx on sales(customer_id);

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  -- snapshot histórico (preserva relatórios antigos mesmo se o cadastro mudar)
  product_name text not null,
  size text not null,
  color text not null default '',
  category_name text,
  collection_name text,
  quantity integer not null check (quantity > 0),
  returned_qty integer not null default 0,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  unit_cost numeric(12,2) not null check (unit_cost >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0), -- desconto rateado na linha
  check (returned_qty >= 0 and returned_qty <= quantity)
);
create index if not exists sale_items_sale_idx on sale_items(sale_id);
create index if not exists sale_items_variant_idx on sale_items(variant_id);

-- ---------- Pagamentos ----------
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references sales(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  method text not null check (method in ('dinheiro','pix','credito','debito','fiado')),
  kind text not null check (kind in ('venda','recebimento_fiado','devolucao','estorno')),
  amount numeric(12,2) not null check (amount <> 0),             -- negativo = saída (devolução/estorno)
  notes text,
  paid_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index if not exists payments_sale_idx on payments(sale_id);
create index if not exists payments_paid_idx on payments(paid_at desc);

-- ---------- Despesas e caixa ----------
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null check (length(trim(description)) > 0),
  category text not null default 'Outros',
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null default current_date,
  payment_method text not null default 'dinheiro' check (payment_method in ('dinheiro','pix','credito','debito')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists expenses_date_idx on expenses(expense_date);

create table if not exists cash_registers (
  id uuid primary key default gen_random_uuid(),
  period_start timestamptz not null,
  period_end timestamptz not null,
  totals jsonb not null default '{}'::jsonb,
  expected_cash numeric(12,2) not null,
  counted_cash numeric(12,2) not null check (counted_cash >= 0),
  difference numeric(12,2) not null,
  notes text,
  closed_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------- View: itens vendidos já líquidos de devoluções/cancelamentos ----------
create or replace view sale_items_net with (security_invoker = true) as
select
  si.id,
  si.sale_id,
  s.created_at as sold_at,
  s.status,
  si.product_id,
  si.variant_id,
  si.product_name,
  si.size,
  si.color,
  si.category_name,
  si.collection_name,
  (si.quantity - si.returned_qty) as qty,
  round((si.unit_price * si.quantity - si.discount) * (si.quantity - si.returned_qty)::numeric / si.quantity, 2) as revenue,
  si.unit_cost * (si.quantity - si.returned_qty) as cost
from sale_items si
join sales s on s.id = si.sale_id
where s.status <> 'cancelada';

-- =====================================================================
-- FUNÇÕES TRANSACIONAIS (cada chamada RPC roda em uma única transação)
-- =====================================================================

-- Finaliza uma venda: valida estoque (com lock), baixa estoque, grava itens
-- com preço/custo históricos, pagamentos e fiado.
-- p_items:    [{"variant_id": uuid, "quantity": int, "unit_price": numeric}]
-- p_payments: [{"method": "pix", "amount": 100.00}]
create or replace function finalize_sale(
  p_customer_id uuid,
  p_items jsonb,
  p_discount numeric,
  p_payments jsonb,
  p_notes text default null
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_sale_id uuid := gen_random_uuid();
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := round(coalesce(p_discount, 0), 2);
  v_total numeric(12,2);
  v_cost numeric(12,2) := 0;
  v_paid numeric(12,2) := 0;
  v_pending numeric(12,2) := 0;
  v_remaining numeric(12,2);
  v_n int;
  r record;
  q record;
  v_stock int;
  v_bal int;
  v_cost_unit numeric(12,2);
  v_pname text;
  v_size text;
  v_price numeric(12,2);
  v_line numeric(12,2);
  v_line_disc numeric(12,2);
  v_pay jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'O carrinho está vazio';
  end if;
  if v_discount < 0 then
    raise exception 'Desconto inválido';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) e where (e->>'quantity')::int <= 0) then
    raise exception 'Quantidade inválida no carrinho';
  end if;

  -- 1) trava as variações em ordem fixa (evita deadlock), valida e baixa o estoque
  for r in
    select (e->>'variant_id')::uuid as variant_id, sum((e->>'quantity')::int)::int as qty
    from jsonb_array_elements(p_items) e
    group by 1
    order by 1
  loop
    select v.stock, p.name, v.size, p.cost_price
      into v_stock, v_pname, v_size, v_cost_unit
    from product_variants v
    join products p on p.id = v.product_id
    where v.id = r.variant_id and v.active and p.active
    for update of v;

    if not found then
      raise exception 'Produto ou variação não encontrado, ou inativo';
    end if;
    if v_stock < r.qty then
      raise exception 'Estoque insuficiente para % (%): disponível %, solicitado %',
        v_pname, v_size, v_stock, r.qty;
    end if;

    update product_variants set stock = stock - r.qty where id = r.variant_id
      returning stock into v_bal;

    insert into stock_movements (variant_id, type, quantity, balance_after, unit_cost, reference_id, notes)
    values (r.variant_id, 'venda', -r.qty, v_bal, v_cost_unit, v_sale_id, 'Venda');
  end loop;

  -- 2) totais
  select coalesce(sum((e->>'quantity')::int * coalesce((e->>'unit_price')::numeric, p.sale_price)), 0)
    into v_subtotal
  from jsonb_array_elements(p_items) e
  join product_variants v on v.id = (e->>'variant_id')::uuid
  join products p on p.id = v.product_id;

  if v_discount > v_subtotal then
    raise exception 'O desconto não pode ser maior que o subtotal';
  end if;
  v_total := v_subtotal - v_discount;

  -- 3) valida pagamentos
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' then
    p_payments := '[]'::jsonb;
  end if;
  if exists (select 1 from jsonb_array_elements(p_payments) x where coalesce((x->>'amount')::numeric, 0) <= 0) then
    raise exception 'Valor de pagamento inválido';
  end if;
  select coalesce(sum((x->>'amount')::numeric), 0),
         coalesce(sum(case when x->>'method' = 'fiado' then (x->>'amount')::numeric else 0 end), 0)
    into v_paid, v_pending
  from jsonb_array_elements(p_payments) x;

  if v_total > 0 and abs(v_paid - v_total) > 0.005 then
    raise exception 'A soma dos pagamentos (%) difere do total da venda (%)', v_paid, v_total;
  end if;
  if v_pending > 0 and p_customer_id is null then
    raise exception 'Selecione um cliente para vendas no fiado';
  end if;

  -- 4) venda
  insert into sales (id, customer_id, status, subtotal, discount, total, amount_pending, notes)
  values (v_sale_id, p_customer_id, case when v_pending > 0 then 'pendente' else 'concluida' end,
          v_subtotal, v_discount, v_total, v_pending, p_notes);

  -- 5) itens (desconto rateado proporcionalmente; resto vai na última linha)
  v_remaining := v_discount;
  v_n := jsonb_array_length(p_items);
  for r in
    select e.value as item, e.ordinality as idx
    from jsonb_array_elements(p_items) with ordinality as e(value, ordinality)
  loop
    select p.id as pid, p.name as pname, p.cost_price, p.sale_price, v.size, v.color,
           c.name as cname, col.name as colname
      into q
    from product_variants v
    join products p on p.id = v.product_id
    left join categories c on c.id = p.category_id
    left join collections col on col.id = p.collection_id
    where v.id = (r.item->>'variant_id')::uuid;

    v_price := coalesce((r.item->>'unit_price')::numeric, q.sale_price);
    if v_price < 0 then raise exception 'Preço inválido'; end if;
    v_line := (r.item->>'quantity')::int * v_price;

    if r.idx = v_n then
      v_line_disc := v_remaining;
    elsif v_subtotal > 0 then
      v_line_disc := round(v_discount * v_line / v_subtotal, 2);
    else
      v_line_disc := 0;
    end if;
    v_remaining := v_remaining - v_line_disc;

    insert into sale_items (sale_id, variant_id, product_id, product_name, size, color,
                            category_name, collection_name, quantity, unit_price, unit_cost, discount)
    values (v_sale_id, (r.item->>'variant_id')::uuid, q.pid, q.pname, q.size, q.color,
            q.cname, q.colname, (r.item->>'quantity')::int, v_price, q.cost_price, v_line_disc);

    v_cost := v_cost + (r.item->>'quantity')::int * q.cost_price;
  end loop;

  update sales set cost_total = v_cost, profit = v_total - v_cost where id = v_sale_id;

  -- 6) pagamentos
  for v_pay in select value from jsonb_array_elements(p_payments) loop
    insert into payments (sale_id, customer_id, method, kind, amount)
    values (v_sale_id, p_customer_id, v_pay->>'method', 'venda', (v_pay->>'amount')::numeric);
  end loop;

  return v_sale_id;
end;
$$;

-- Cancela a venda: devolve ao estoque o que ainda não foi devolvido e estorna pagamentos.
create or replace function cancel_sale(p_sale_id uuid, p_reason text default null)
returns void
language plpgsql
set search_path = public
as $$
declare
  s sales%rowtype;
  r record;
  v_bal int;
begin
  select * into s from sales where id = p_sale_id for update;
  if not found then raise exception 'Venda não encontrada'; end if;
  if s.status = 'cancelada' then raise exception 'Esta venda já foi cancelada'; end if;

  for r in
    select * from sale_items
    where sale_id = p_sale_id and variant_id is not null and quantity - returned_qty > 0
    order by variant_id
  loop
    update product_variants set stock = stock + (r.quantity - r.returned_qty)
      where id = r.variant_id returning stock into v_bal;
    insert into stock_movements (variant_id, type, quantity, balance_after, unit_cost, reference_id, notes)
    values (r.variant_id, 'cancelamento', r.quantity - r.returned_qty, v_bal, r.unit_cost, p_sale_id, 'Cancelamento de venda');
  end loop;

  for r in
    select method, sum(amount) as total from payments
    where sale_id = p_sale_id group by method having sum(amount) <> 0
  loop
    insert into payments (sale_id, customer_id, method, kind, amount, notes)
    values (p_sale_id, s.customer_id, r.method, 'estorno', -r.total, 'Cancelamento de venda');
  end loop;

  update sales
     set status = 'cancelada', amount_pending = 0, canceled_at = now(), cancel_reason = nullif(trim(p_reason), '')
   where id = p_sale_id;
end;
$$;

-- Devolução parcial ou total de itens.
-- p_items: [{"sale_item_id": uuid, "quantity": int}]
create or replace function return_sale_items(
  p_sale_id uuid,
  p_items jsonb,
  p_refund_method text default 'dinheiro',
  p_notes text default null
) returns numeric
language plpgsql
set search_path = public
as $$
declare
  s sales%rowtype;
  si sale_items%rowtype;
  r record;
  v_refund numeric(12,2) := 0;
  v_line numeric(12,2);
  v_bal int;
  v_from_pending numeric(12,2);
  v_cash numeric(12,2);
begin
  if p_refund_method not in ('dinheiro','pix','credito','debito') then
    raise exception 'Forma de reembolso inválida';
  end if;

  select * into s from sales where id = p_sale_id for update;
  if not found then raise exception 'Venda não encontrada'; end if;
  if s.status = 'cancelada' then raise exception 'Venda cancelada não aceita devolução'; end if;

  for r in
    select (e->>'sale_item_id')::uuid as id, (e->>'quantity')::int as qty
    from jsonb_array_elements(p_items) e
    order by 1
  loop
    if r.qty <= 0 then continue; end if;

    select * into si from sale_items where id = r.id and sale_id = p_sale_id for update;
    if not found then raise exception 'Item não pertence a esta venda'; end if;
    if si.returned_qty + r.qty > si.quantity then
      raise exception 'Quantidade devolvida de "%" excede a quantidade vendida', si.product_name;
    end if;

    v_line := round((si.unit_price * si.quantity - si.discount) * r.qty / si.quantity, 2);
    v_refund := v_refund + v_line;

    update sale_items set returned_qty = returned_qty + r.qty where id = si.id;

    if si.variant_id is not null then
      update product_variants set stock = stock + r.qty where id = si.variant_id returning stock into v_bal;
      insert into stock_movements (variant_id, type, quantity, balance_after, unit_cost, reference_id, notes)
      values (si.variant_id, 'devolucao', r.qty, v_bal, si.unit_cost, p_sale_id, coalesce(p_notes, 'Devolução de venda'));
    end if;
  end loop;

  if v_refund <= 0 then raise exception 'Nenhum item informado para devolução'; end if;

  v_from_pending := least(s.amount_pending, v_refund);
  v_cash := v_refund - v_from_pending;

  if v_from_pending > 0 then
    insert into payments (sale_id, customer_id, method, kind, amount, notes)
    values (p_sale_id, s.customer_id, 'fiado', 'devolucao', -v_from_pending, 'Devolução abatida do fiado');
  end if;
  if v_cash > 0 then
    insert into payments (sale_id, customer_id, method, kind, amount, notes)
    values (p_sale_id, s.customer_id, p_refund_method, 'devolucao', -v_cash, coalesce(p_notes, 'Devolução'));
  end if;

  update sales
     set refunded_total = refunded_total + v_refund,
         amount_pending = amount_pending - v_from_pending,
         status = case when amount_pending - v_from_pending > 0 then 'pendente' else 'concluida' end
   where id = p_sale_id;

  return v_refund;
end;
$$;

-- Recebimento de fiado.
create or replace function receive_fiado(p_sale_id uuid, p_amount numeric, p_method text)
returns void
language plpgsql
set search_path = public
as $$
declare
  s sales%rowtype;
  v_amount numeric(12,2) := round(p_amount, 2);
begin
  if p_method not in ('dinheiro','pix','credito','debito') then
    raise exception 'Forma de pagamento inválida';
  end if;
  select * into s from sales where id = p_sale_id for update;
  if not found then raise exception 'Venda não encontrada'; end if;
  if s.status <> 'pendente' then raise exception 'Esta venda não possui valor pendente'; end if;
  if v_amount <= 0 or v_amount > s.amount_pending then
    raise exception 'Valor inválido. Pendente: %', s.amount_pending;
  end if;

  insert into payments (sale_id, customer_id, method, kind, amount, notes)
  values (p_sale_id, s.customer_id, p_method, 'recebimento_fiado', v_amount, 'Recebimento de fiado');

  update sales
     set amount_pending = amount_pending - v_amount,
         status = case when amount_pending - v_amount <= 0 then 'concluida' else 'pendente' end
   where id = p_sale_id;
end;
$$;

-- Ajuste manual de estoque (define o novo saldo e registra a diferença).
create or replace function adjust_stock(
  p_variant_id uuid,
  p_new_quantity int,
  p_reason text,
  p_type text default 'ajuste'
) returns void
language plpgsql
set search_path = public
as $$
declare
  v_old int;
  v_cost numeric(12,2);
begin
  if p_new_quantity is null or p_new_quantity < 0 then
    raise exception 'A quantidade não pode ser negativa';
  end if;
  select v.stock, p.cost_price into v_old, v_cost
  from product_variants v join products p on p.id = v.product_id
  where v.id = p_variant_id
  for update of v;
  if not found then raise exception 'Variação não encontrada'; end if;
  if p_new_quantity = v_old then return; end if;

  update product_variants set stock = p_new_quantity where id = p_variant_id;
  insert into stock_movements (variant_id, type, quantity, balance_after, unit_cost, notes)
  values (p_variant_id, case when p_type = 'entrada' then 'entrada' else 'ajuste' end,
          p_new_quantity - v_old, p_new_quantity, v_cost, nullif(trim(p_reason), ''));
end;
$$;

-- Registra compra/reposição: entra no estoque, guarda o custo pago e atualiza o custo médio.
-- p_items: [{"variant_id": uuid, "quantity": int, "unit_cost": numeric}]
create or replace function register_purchase(
  p_supplier_id uuid,
  p_date date,
  p_notes text,
  p_items jsonb
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_total numeric(12,2) := 0;
  r record;
  v_pid uuid;
  v_stock_total int;
  v_cost numeric(12,2);
  v_new_cost numeric(12,2);
  v_bal int;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Informe ao menos um item na compra';
  end if;

  insert into purchases (id, supplier_id, purchase_date, notes, total)
  values (v_id, p_supplier_id, coalesce(p_date, current_date), nullif(trim(p_notes), ''), 0);

  for r in
    select (e->>'variant_id')::uuid as variant_id,
           (e->>'quantity')::int as qty,
           (e->>'unit_cost')::numeric as unit_cost
    from jsonb_array_elements(p_items) e
    order by 1
  loop
    if r.qty <= 0 then raise exception 'Quantidade inválida na compra'; end if;
    if r.unit_cost is null or r.unit_cost < 0 then raise exception 'Custo inválido na compra'; end if;

    select v.product_id into v_pid from product_variants v where v.id = r.variant_id for update;
    if not found then raise exception 'Variação não encontrada'; end if;

    select coalesce(sum(stock), 0) into v_stock_total from product_variants where product_id = v_pid;
    select cost_price into v_cost from products where id = v_pid for update;

    -- custo médio ponderado
    v_new_cost := round((v_stock_total * v_cost + r.qty * r.unit_cost) / (v_stock_total + r.qty), 2);
    update products set cost_price = v_new_cost where id = v_pid;

    update product_variants set stock = stock + r.qty where id = r.variant_id returning stock into v_bal;

    insert into purchase_items (purchase_id, variant_id, quantity, unit_cost)
    values (v_id, r.variant_id, r.qty, r.unit_cost);

    insert into stock_movements (variant_id, type, quantity, balance_after, unit_cost, reference_id, notes)
    values (r.variant_id, 'compra', r.qty, v_bal, r.unit_cost, v_id, 'Compra / reposição');

    v_total := v_total + r.qty * r.unit_cost;
  end loop;

  update purchases set total = v_total where id = v_id;
  return v_id;
end;
$$;

-- ---------- Caixa ----------
create or replace function cash_preview()
returns json
language plpgsql
stable
set search_path = public
as $$
declare
  v_start timestamptz;
  v_totals jsonb;
  v_exp numeric;
begin
  select coalesce(max(period_end), '1970-01-01'::timestamptz) into v_start from cash_registers;

  select coalesce(jsonb_object_agg(method, total), '{}'::jsonb) into v_totals
  from (
    select method, sum(amount) as total from payments
    where paid_at > v_start and paid_at <= now()
    group by method
  ) t;

  select coalesce(sum(amount), 0) into v_exp from expenses
  where payment_method = 'dinheiro' and created_at > v_start and created_at <= now();

  return json_build_object(
    'period_start', v_start,
    'totals', v_totals,
    'cash_expenses', v_exp,
    'expected_cash', coalesce((v_totals->>'dinheiro')::numeric, 0) - v_exp
  );
end;
$$;

create or replace function close_cash_register(p_counted numeric, p_notes text default null)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v json;
  v_id uuid := gen_random_uuid();
begin
  if p_counted is null or p_counted < 0 then raise exception 'Valor contado inválido'; end if;
  v := cash_preview();
  insert into cash_registers (id, period_start, period_end, totals, expected_cash, counted_cash, difference, notes)
  values (v_id, (v->>'period_start')::timestamptz, now(), (v->'totals')::jsonb,
          (v->>'expected_cash')::numeric, p_counted, p_counted - (v->>'expected_cash')::numeric,
          nullif(trim(p_notes), ''));
  return v_id;
end;
$$;

-- =====================================================================
-- RELATÓRIOS (agregações no banco; datas sempre no fuso de São Paulo)
-- p_to é exclusivo.
-- =====================================================================

create or replace function report_summary(p_from timestamptz, p_to timestamptz)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object(
    'revenue', coalesce(sum(n.revenue), 0),
    'cogs', coalesce(sum(n.cost), 0),
    'profit', coalesce(sum(n.revenue - n.cost), 0),
    'pieces', coalesce(sum(n.qty), 0),
    'sales_count', (select count(*) from sales s
                    where s.status <> 'cancelada' and s.created_at >= p_from and s.created_at < p_to),
    'pending_count', (select count(*) from sales where status = 'pendente'),
    'pending_amount', (select coalesce(sum(amount_pending), 0) from sales where status = 'pendente'),
    'expenses', (select coalesce(sum(e.amount), 0) from expenses e
                 where e.expense_date >= (p_from at time zone 'America/Sao_Paulo')::date
                   and e.expense_date <= ((p_to - interval '1 second') at time zone 'America/Sao_Paulo')::date)
  )
  from sale_items_net n
  where n.sold_at >= p_from and n.sold_at < p_to;
$$;

create or replace function report_by_day(p_from timestamptz, p_to timestamptz)
returns table(day date, revenue numeric, cost numeric, profit numeric, pieces bigint, sales_count bigint)
language sql
stable
set search_path = public
as $$
  select (n.sold_at at time zone 'America/Sao_Paulo')::date,
         sum(n.revenue), sum(n.cost), sum(n.revenue - n.cost),
         sum(n.qty)::bigint, count(distinct n.sale_id)
  from sale_items_net n
  where n.sold_at >= p_from and n.sold_at < p_to
  group by 1
  order by 1;
$$;

-- p_group: 'size' | 'category' | 'collection'
create or replace function report_breakdown(p_from timestamptz, p_to timestamptz, p_group text)
returns table(label text, pieces bigint, revenue numeric, cost numeric, profit numeric)
language sql
stable
set search_path = public
as $$
  select case p_group
           when 'size' then n.size
           when 'category' then coalesce(n.category_name, 'Sem categoria')
           when 'collection' then coalesce(n.collection_name, 'Sem linha')
           else 'Outros'
         end,
         sum(n.qty)::bigint, sum(n.revenue), sum(n.cost), sum(n.revenue - n.cost)
  from sale_items_net n
  where n.sold_at >= p_from and n.sold_at < p_to
  group by 1
  having sum(n.qty) > 0
  order by sum(n.revenue) desc;
$$;

create or replace function report_products(p_from timestamptz, p_to timestamptz)
returns table(product text, pieces bigint, revenue numeric, cost numeric, profit numeric, sizes text)
language sql
stable
set search_path = public
as $$
  with base as (
    select n.product_name, n.size, sum(n.qty) as q, sum(n.revenue) as rev, sum(n.cost) as cst
    from sale_items_net n
    where n.sold_at >= p_from and n.sold_at < p_to
    group by n.product_name, n.size
    having sum(n.qty) > 0
  )
  select b.product_name, sum(b.q)::bigint, sum(b.rev), sum(b.cst), sum(b.rev - b.cst),
         string_agg(b.size || ' ×' || b.q, ', ' order by b.size)
  from base b
  group by b.product_name
  order by sum(b.rev) desc;
$$;

create or replace function payments_by_method(p_from timestamptz, p_to timestamptz)
returns table(method text, total numeric)
language sql
stable
set search_path = public
as $$
  select p.method, sum(p.amount)
  from payments p
  where p.paid_at >= p_from and p.paid_at < p_to
  group by p.method
  order by sum(p.amount) desc;
$$;

create or replace function stock_summary()
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object(
    'pieces', coalesce(sum(v.stock), 0),
    'cost_value', coalesce(sum(v.stock * p.cost_price), 0),
    'low_count', count(*) filter (where v.stock > 0 and v.stock <= v.min_stock),
    'out_count', count(*) filter (where v.stock = 0)
  )
  from product_variants v
  join products p on p.id = v.product_id
  where v.active and p.active;
$$;

create or replace function low_stock_variants(p_limit int default 20)
returns table(variant_id uuid, product_name text, size text, color text, stock int, min_stock int)
language sql
stable
set search_path = public
as $$
  select v.id, p.name, v.size, v.color, v.stock, v.min_stock
  from product_variants v
  join products p on p.id = v.product_id
  where v.active and p.active and v.stock <= v.min_stock
  order by v.stock, p.name
  limit p_limit;
$$;

create or replace function customer_stats()
returns table(customer_id uuid, total_spent numeric, pending numeric, purchases bigint)
language sql
stable
set search_path = public
as $$
  select c.id,
         coalesce(sum(case when s.status <> 'cancelada' then s.total - s.refunded_total end), 0),
         coalesce(sum(s.amount_pending), 0),
         count(s.id) filter (where s.status <> 'cancelada')
  from customers c
  left join sales s on s.customer_id = c.id
  group by c.id;
$$;

-- =====================================================================
-- SEGURANÇA (RLS)
-- Modelo de loja única: qualquer usuário AUTENTICADO tem acesso total.
-- Usuários anônimos não acessam nada. Desative o cadastro público
-- (Authentication > Providers > Email > "Allow new users to sign up")
-- e crie os usuários manualmente no painel do Supabase.
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'categories','collections','suppliers','customers','products','product_variants',
    'purchases','purchase_items','stock_movements','sales','sale_items','payments',
    'expenses','cash_registers'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "authenticated_all" on %I', t);
    execute format('create policy "authenticated_all" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- ---------- Storage: imagens de produtos ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_read" on storage.objects;
create policy "product_images_read" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "product_images_insert" on storage.objects;
create policy "product_images_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images');

drop policy if exists "product_images_update" on storage.objects;
create policy "product_images_update" on storage.objects
  for update to authenticated using (bucket_id = 'product-images');

drop policy if exists "product_images_delete" on storage.objects;
create policy "product_images_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images');

-- ---------- Dados iniciais (apenas listas de apoio, sem vendas) ----------
insert into categories (name) values
  ('Conjuntos'), ('Conjuntos de calça'), ('Vestidos'), ('Blusas'), ('Calças'),
  ('Shorts'), ('Saias'), ('Macacões'), ('Acessórios')
on conflict (name) do nothing;

insert into collections (name) values
  ('Moda Praia'), ('Linha Noite'), ('Casual'), ('Moda Festa'), ('Fitness'), ('Básicos')
on conflict (name) do nothing;
