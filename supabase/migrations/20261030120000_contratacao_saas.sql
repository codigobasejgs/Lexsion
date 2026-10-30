-- Contratação self-service da LexSion (InfinitePay Checkout Integrado). ADITIVA: só cria tabelas, funções e uma
-- trigger nova; nenhum dado existente é alterado. Reversão: drop das tabelas saas_* e das funções saas_*.
-- Regras:
--  * preço vem SEMPRE do banco (saas_plans), nunca do navegador; plano só é vendido com approved = true (dono aprova);
--  * pagamento só é aceito depois de conferido no /payment_check oficial (webhook não tem assinatura);
--  * ativação e renovação são funções transacionais e idempotentes (rodar 2x não cria 2 escritórios nem 2 períodos);
--  * escrita só pelo servidor (service_role); titular e plataforma só LEEM o que lhes cabe (RLS).

create table if not exists public.saas_plans (
  id text primary key check (id ~ '^[a-z0-9-]{2,30}$'),
  label text not null check (length(label) between 2 and 60),
  description text not null default '',
  price_monthly int not null check (price_monthly >= 100),          -- centavos (mínimo da InfinitePay: R$ 1,00)
  price_yearly int check (price_yearly is null or price_yearly >= 100), -- null = ciclo anual não oferecido
  max_users int not null check (max_users between 1 and 1000),
  trial_days int not null default 0 check (trial_days between 0 and 30),
  features jsonb not null default '[]'::jsonb,                        -- [{ "label": "...", "ok": true|false }]
  visible boolean not null default true,
  approved boolean not null default false,                            -- preços aprovados pelo dono: sem isso, não vende
  sort int not null default 0,
  version int not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.saas_orders (
  id uuid primary key default gen_random_uuid(),
  order_nsu text not null unique default ('lx-' || replace(gen_random_uuid()::text, '-', '')),
  kind text not null default 'contratacao' check (kind in ('contratacao','renovacao')),
  organization_id uuid references public.organizations(id) on delete set null,
  plan_id text not null references public.saas_plans(id),
  cycle text not null check (cycle in ('mensal','anual')),
  amount int not null check (amount >= 100),
  plan_snapshot jsonb not null,                                       -- versão contratual do plano no momento do pedido
  customer jsonb not null,                                            -- titular e escritório informados no cadastro
  contract_version text,
  contract_accepted_at timestamptz,
  request_fingerprint text,                                           -- hash do IP (antiabuso), nunca o IP
  status text not null default 'pendente' check (status in ('pendente','pago','estornado','cancelado','expirado')),
  checkout_url text,
  invoice_slug text,
  transaction_nsu text,
  receipt_url text,
  capture_method text,
  paid_amount int,
  installments int,
  paid_at timestamptz,
  activation text not null default 'aguardando' check (activation in ('aguardando','concluida','falhou')),
  activation_error text,
  activation_attempts int not null default 0,
  period_start date,
  period_end date,
  expires_at timestamptz,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Uma transação da InfinitePay vale para UM pedido; um endereço (slug) só pode ter um cadastro pendente por vez.
create unique index if not exists saas_orders_tx on public.saas_orders (transaction_nsu) where transaction_nsu is not null;
create unique index if not exists saas_orders_pending_slug on public.saas_orders ((lower(customer->>'slug'))) where status = 'pendente' and kind = 'contratacao';
create unique index if not exists saas_orders_pending_renewal on public.saas_orders (organization_id) where status = 'pendente' and kind = 'renovacao';
create index if not exists saas_orders_org on public.saas_orders (organization_id, created_at desc);

create table if not exists public.saas_subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan_id text not null references public.saas_plans(id),
  cycle text not null check (cycle in ('mensal','anual')),
  status text not null check (status in ('ativa','vencida','suspensa','cancelada')),
  price int not null check (price >= 100),                            -- preço contratado (não muda se o plano mudar)
  plan_snapshot jsonb not null,
  max_users int not null check (max_users >= 1),
  current_period_start date not null,
  current_period_end date not null,
  cancel_at_period_end boolean not null default false,
  change_request jsonb,                                               -- pedido de troca de plano do titular
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saas_webhook_events (
  id bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  order_nsu text,
  body_sha256 text not null unique,                                   -- aviso repetido é registrado uma vez só
  body jsonb not null,
  outcome text not null default 'recebido'
);

alter table public.saas_plans enable row level security;
alter table public.saas_orders enable row level security;
alter table public.saas_subscriptions enable row level security;
alter table public.saas_webhook_events enable row level security;

-- Titular de UM escritório (sem exigir escritório ativo: suspenso por inadimplência precisa ver o que pagar).
create or replace function public.is_org_owner(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_memberships m where m.organization_id = org and m.user_id = auth.uid() and m.role = 'admin')
$$;

drop policy if exists saas_plans_read on public.saas_plans;
create policy saas_plans_read on public.saas_plans for select to authenticated using (visible or public.is_platform());
drop policy if exists saas_orders_read on public.saas_orders;
create policy saas_orders_read on public.saas_orders for select to authenticated
  using (public.is_platform(array['superadmin','platform_admin']) or (organization_id is not null and public.is_org_owner(organization_id)));
drop policy if exists saas_subs_read on public.saas_subscriptions;
create policy saas_subs_read on public.saas_subscriptions for select to authenticated
  using (public.is_platform(array['superadmin','platform_admin']) or public.is_org_owner(organization_id));
drop policy if exists saas_events_read on public.saas_webhook_events;
create policy saas_events_read on public.saas_webhook_events for select to authenticated using (public.is_platform(array['superadmin','platform_admin']));

revoke all on public.saas_plans, public.saas_orders, public.saas_subscriptions, public.saas_webhook_events from anon, authenticated;
grant select on public.saas_plans, public.saas_orders, public.saas_subscriptions, public.saas_webhook_events to authenticated;

-- Planos PROPOSTOS (aguardando aprovação do dono: approved = false ⇒ nenhuma venda). Anual e teste grátis desligados.
insert into public.saas_plans (id, label, description, price_monthly, price_yearly, max_users, trial_days, sort, features) values
  ('solo', 'Solo', 'Advocacia individual', 9990, null, 1, 0, 1, '[]'),
  ('profissional', 'Profissional', 'Escritórios com equipe', 24990, null, 5, 0, 2, '[]'),
  ('elite', 'Elite', 'Operações com várias equipes', 49990, null, 15, 0, 3, '[]')
on conflict (id) do nothing;
update public.saas_plans set features = '[
  {"label":"Clientes, casos, processos e documentos","ok":true},
  {"label":"Agenda, prazos e tarefas","ok":true},
  {"label":"Propostas, contratos e financeiro (baixa manual)","ok":true},
  {"label":"Portal do cliente","ok":true},
  {"label":"Minutas com aprovação","ok":true},
  {"label":"Monitoramento legislativo (Câmara e Senado)","ok":true},
  {"label":"Assistente de IA com revisão humana","ok":true},
  {"label":"Marca própria e aplicativo do escritório","ok":true},
  {"label":"Equipe com permissões por pessoa","ok":true},
  {"label":"Cobrança online de honorários","ok":false},
  {"label":"Assinatura eletrônica","ok":false},
  {"label":"Automações e envio em massa","ok":false}
]'::jsonb where features = '[]'::jsonb;

-- Ativação de contratação paga: cria escritório + titular + assinatura numa transação. Idempotente.
create or replace function public.saas_activate(p_order uuid, p_owner uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare o public.saas_orders; org uuid; months int;
begin
  select * into o from public.saas_orders where id = p_order for update;
  if o.id is null then raise exception 'pedido não encontrado' using errcode = 'P0002'; end if;
  if o.activation = 'concluida' then return o.organization_id; end if;
  if o.status <> 'pago' or o.kind <> 'contratacao' then raise exception 'pedido não está pago' using errcode = '22023'; end if;
  months := case o.cycle when 'anual' then 12 else 1 end;
  if exists (select 1 from public.organizations where slug = lower(o.customer->>'slug')) then raise exception 'endereço já em uso' using errcode = '23505'; end if;
  insert into public.organizations (slug, name, status, plan, branding, meta)
    values (lower(o.customer->>'slug'), o.customer->>'office', 'ativa', o.plan_id,
            jsonb_build_object('brandName', o.customer->>'office', 'pwaShortName', left(o.customer->>'office', 12)),
            jsonb_build_object('ownerName', o.customer->>'name', 'ownerEmail', o.customer->>'email', 'document', o.customer->>'document', 'cycle', o.cycle, 'origem', 'contratacao', 'order', o.order_nsu))
    returning id into org;
  insert into public.organization_memberships (organization_id, user_id, role) values (org, p_owner, 'admin');
  insert into public.saas_subscriptions (organization_id, plan_id, cycle, status, price, plan_snapshot, max_users, current_period_start, current_period_end)
    values (org, o.plan_id, o.cycle, 'ativa', o.amount, o.plan_snapshot, (o.plan_snapshot->>'max_users')::int,
            (o.paid_at at time zone 'America/Sao_Paulo')::date, ((o.paid_at at time zone 'America/Sao_Paulo')::date + make_interval(months => months))::date);
  update public.saas_orders set organization_id = org, activation = 'concluida', activation_error = null, activation_attempts = activation_attempts + 1,
    period_start = (paid_at at time zone 'America/Sao_Paulo')::date, period_end = ((paid_at at time zone 'America/Sao_Paulo')::date + make_interval(months => months))::date,
    history = history || jsonb_build_array(jsonb_build_object('at', now(), 'text', 'Escritório ativado')), updated_at = now() where id = o.id;
  insert into public.audit_logs (organization_id, actor_id, action, entity, entity_id, detail)
    values (org, null, 'assinatura.ativada', 'saas_orders', o.order_nsu, o.plan_id || '/' || o.cycle || ' — ' || o.amount || ' centavos');
  return org;
end $$;

-- Renovação paga: estende o período a partir do fim atual (ou de hoje, se já venceu) e reativa se a suspensão foi por falta de pagamento.
create or replace function public.saas_apply_renewal(p_order uuid) returns date
language plpgsql security definer set search_path = public as $$
declare o public.saas_orders; s public.saas_subscriptions; base date; fim date;
begin
  select * into o from public.saas_orders where id = p_order for update;
  if o.id is null then raise exception 'pedido não encontrado' using errcode = 'P0002'; end if;
  if o.activation = 'concluida' then return o.period_end; end if;
  if o.status <> 'pago' or o.kind <> 'renovacao' then raise exception 'renovação não está paga' using errcode = '22023'; end if;
  select * into s from public.saas_subscriptions where organization_id = o.organization_id for update;
  if s.organization_id is null then raise exception 'assinatura não encontrada' using errcode = 'P0002'; end if;
  base := greatest(s.current_period_end, (o.paid_at at time zone 'America/Sao_Paulo')::date);
  fim := (base + make_interval(months => case o.cycle when 'anual' then 12 else 1 end))::date;
  -- O pedido de renovação já foi emitido com o plano/preço pedidos pelo titular (troca vale no período novo).
  update public.saas_subscriptions set status = 'ativa', current_period_start = base, current_period_end = fim,
    plan_id = o.plan_id, cycle = o.cycle, price = o.amount,
    plan_snapshot = case when o.plan_snapshot = '{}'::jsonb then plan_snapshot else o.plan_snapshot end,
    max_users = coalesce((o.plan_snapshot->>'max_users')::int, max_users), change_request = null, updated_at = now() where organization_id = s.organization_id;
  update public.organizations set plan = o.plan_id, updated_at = now() where id = s.organization_id and plan is distinct from o.plan_id;
  update public.organizations set status = 'ativa', status_reason = null, updated_at = now()
    where id = s.organization_id and status = 'suspensa' and status_reason like 'Inadimplência%';
  update public.saas_orders set activation = 'concluida', activation_attempts = activation_attempts + 1, period_start = base, period_end = fim,
    history = history || jsonb_build_array(jsonb_build_object('at', now(), 'text', 'Período renovado até ' || to_char(fim, 'DD/MM/YYYY'))), updated_at = now() where id = o.id;
  insert into public.audit_logs (organization_id, actor_id, action, entity, entity_id, detail)
    values (s.organization_id, null, 'assinatura.renovada', 'saas_orders', o.order_nsu, 'até ' || fim);
  return fim;
end $$;

-- Limite de usuários do plano contratado (só para escritórios com assinatura; os demais seguem como estão).
create or replace function public.memberships_quota() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim int; n int;
begin
  select max_users into lim from public.saas_subscriptions where organization_id = new.organization_id;
  if lim is null then return new; end if;
  select count(*) into n from public.organization_memberships where organization_id = new.organization_id;
  if n >= lim then raise exception 'limite de % usuário(s) do plano atingido; peça a troca de plano', lim using errcode = '23514'; end if;
  return new;
end $$;
drop trigger if exists memberships_quota on public.organization_memberships;
create trigger memberships_quota before insert on public.organization_memberships for each row execute function public.memberships_quota();

-- Planos comerciais novos também valem na troca de plano pela plataforma.
create or replace function public.set_organization_plan(p_org uuid, p_plan text) returns public.organizations
language plpgsql security definer set search_path = public as $$
declare o public.organizations;
begin
  if not public.is_platform(array['superadmin','platform_admin']) then raise exception 'somente a plataforma altera o plano' using errcode = '42501'; end if;
  if p_plan not in ('trial','essencial','profissional','avancado','enterprise') and not exists (select 1 from public.saas_plans where id = p_plan) then raise exception 'plano inválido' using errcode = '22023'; end if;
  update public.organizations set plan = p_plan, updated_at = now() where id = p_org returning * into o;
  if o.id is null then raise exception 'escritório não encontrado' using errcode = 'P0002'; end if;
  insert into public.audit_logs (organization_id, actor_id, action, entity, entity_id, detail) values (p_org, auth.uid(), 'plan', 'organizations', p_org::text, p_plan);
  return o;
end $$;

revoke execute on function public.saas_activate(uuid, uuid), public.saas_apply_renewal(uuid), public.memberships_quota() from public, anon, authenticated;
grant execute on function public.saas_activate(uuid, uuid), public.saas_apply_renewal(uuid) to service_role;
revoke execute on function public.is_org_owner(uuid) from public, anon;
grant execute on function public.is_org_owner(uuid) to authenticated;

-- Rotina diária de cobrança (vencimentos, renovação, inadimplência, pendências): mesmo padrão do backup.
create or replace function public.trigger_billing() returns bigint
language plpgsql security definer set search_path = public, extensions, vault as $$
declare secret text; target text; req bigint;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'lexsion_cron_secret';
  select replace(decrypted_secret, '/api/cron/inteligencia', '/api/cron/cobranca') into target from vault.decrypted_secrets where name = 'lexsion_cron_url';
  if secret is null or target is null then raise exception 'segredo ou URL do cron não configurados no Vault'; end if;
  select net.http_get(url := target, headers := jsonb_build_object('Authorization', 'Bearer ' || secret), timeout_milliseconds := 290000) into req;
  return req;
end $$;
revoke execute on function public.trigger_billing() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from cron.job where jobname = 'lexsion-cobranca') then perform cron.unschedule('lexsion-cobranca'); end if;
  perform cron.schedule('lexsion-cobranca', '23 9 * * *', 'select public.trigger_billing()'); -- 06:23 em Brasília
end $$;
