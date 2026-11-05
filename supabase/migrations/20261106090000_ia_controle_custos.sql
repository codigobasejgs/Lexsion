-- Controle financeiro da IA (Gemini) e OCR. Tudo aplicado no BANCO, de forma atômica, antes de qualquer chamada paga.
--  * ai_usage ganha módulo, tokens, páginas, custo estimado, versão do processamento e estado (reservado/concluído/falha);
--  * ai_prices: preço oficial por modelo (fonte: ai.google.dev/gemini-api/docs/pricing), versionado por vigência;
--  * ai_budgets: limites da plataforma, por plano e por escritório (override > plano > plataforma);
--  * ai_settings: chave-mestra do OCR e confirmação EXPRESSA do faturamento pelo Super Admin (padrão: bloqueado);
--  * ocr_cache: resultado por escritório + hash do arquivo + versão (não reprocessa documento idêntico);
--  * ai_reserve/ai_settle: reserva atômica (trava) e acerto com os tokens reais devolvidos pelo provedor.
-- Reversão: drop das tabelas/funções novas e das colunas adicionadas; recriar ai_usage_purpose_check anterior.

alter table public.ai_usage add column if not exists module text not null default 'ia';
alter table public.ai_usage add column if not exists input_tokens int;
alter table public.ai_usage add column if not exists output_tokens int;
alter table public.ai_usage add column if not exists pages int not null default 0;
alter table public.ai_usage add column if not exists cost_usd numeric(12,6) not null default 0;
alter table public.ai_usage add column if not exists estimated boolean not null default true; -- true = por caracteres; false = tokens do provedor
alter table public.ai_usage add column if not exists status text not null default 'concluido';
alter table public.ai_usage add column if not exists processing_version text;
alter table public.ai_usage add column if not exists document_ref text; -- id do documento do escritório (nunca conteúdo)
alter table public.ai_usage add column if not exists latency_ms int;
alter table public.ai_usage add column if not exists key_owner text not null default 'plataforma' check (key_owner in ('plataforma','escritorio'));
alter table public.ai_usage drop constraint if exists ai_usage_purpose_check;
alter table public.ai_usage add constraint ai_usage_purpose_check check (purpose in ('resposta','resumo','minuta','triagem','atendimento','simulador','ocr'));
alter table public.ai_usage drop constraint if exists ai_usage_status_check;
alter table public.ai_usage add constraint ai_usage_status_check check (status in ('reservado','concluido','falha','cache'));
create index if not exists ai_usage_at on public.ai_usage (at desc);

create table if not exists public.ai_prices (
  model text not null,
  valid_from date not null,
  input_per_mtok numeric(10,4) not null check (input_per_mtok >= 0),
  output_per_mtok numeric(10,4) not null check (output_per_mtok >= 0),
  source_url text not null check (source_url ~ '^https://'),
  checked_on date not null,
  primary key (model, valid_from)
);
insert into public.ai_prices (model, valid_from, input_per_mtok, output_per_mtok, source_url, checked_on) values
  ('gemini-2.5-flash-lite', '2026-01-01', 0.10, 0.40, 'https://ai.google.dev/gemini-api/docs/pricing', '2026-11-05'),
  ('gemini-2.5-flash', '2026-01-01', 0.30, 2.50, 'https://ai.google.dev/gemini-api/docs/pricing', '2026-11-05'),
  ('gemini-3.1-flash-lite', '2026-01-01', 0.25, 1.50, 'https://ai.google.dev/gemini-api/docs/pricing', '2026-11-05'),
  ('gemini-2.5-pro', '2026-01-01', 1.25, 10.00, 'https://ai.google.dev/gemini-api/docs/pricing', '2026-11-05')
on conflict do nothing;

create table if not exists public.ai_budgets (
  scope text not null check (scope in ('plataforma','plano','escritorio')),
  ref text not null default '',            -- '' (plataforma), id do plano ou uuid do escritório
  monthly_usd numeric(10,2),               -- só plataforma: teto em dólares no mês (null = sem teto ⇒ NÃO permitido p/ plataforma)
  ocr_pages_day int check (ocr_pages_day >= 0),
  ocr_pages_month int check (ocr_pages_month >= 0),
  alert_pct int not null default 80 check (alert_pct between 10 and 100),
  note text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (scope, ref),
  check (scope <> 'plataforma' or (ref = '' and monthly_usd is not null))
);
-- Limites iniciais CONSERVADORES (proposta técnica; o dono ajusta no painel). Sem linha = sem OCR.
insert into public.ai_budgets (scope, ref, monthly_usd, ocr_pages_day, ocr_pages_month, note) values
  ('plataforma', '', 5.00, 300, 3000, 'teto inicial do piloto'),
  ('plano', 'solo', null, 20, 100, 'proposta'),
  ('plano', 'profissional', null, 50, 300, 'proposta'),
  ('plano', 'elite', null, 150, 1000, 'proposta')
on conflict do nothing;

create table if not exists public.ai_settings (
  id boolean primary key default true check (id),
  ocr_enabled boolean not null default false,
  billing_confirmed_at timestamptz,        -- Super Admin confirmou: projeto Google com faturamento ATIVO (dados não usados para treino)
  billing_confirmed_by uuid references auth.users(id) on delete set null,
  billing_note text not null default '',
  invoice_month text,                      -- custo APURADO informado da fatura Google (conciliação manual)
  invoice_usd numeric(10,2),
  updated_at timestamptz not null default now()
);
insert into public.ai_settings (id) values (true) on conflict do nothing;

create table if not exists public.ocr_cache (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  processing_version text not null,
  model text not null,
  pages int not null,
  ocr_pages int[] not null default '{}',
  lines jsonb not null,                    -- linhas reconhecidas por página (dado do escritório, mesmo nível de org_records)
  created_at timestamptz not null default now(),
  primary key (organization_id, file_sha256, processing_version)
);

-- RLS: ocr_cache e ai_settings só pelo servidor; ai_prices e ai_budgets visíveis à plataforma.
alter table public.ocr_cache enable row level security;
alter table public.ai_settings enable row level security;
alter table public.ai_prices enable row level security;
alter table public.ai_budgets enable row level security;
revoke all on public.ocr_cache, public.ai_settings from anon, authenticated;
revoke all on public.ai_prices, public.ai_budgets from anon;
revoke insert, update, delete, truncate on public.ai_prices, public.ai_budgets from authenticated;
grant select on public.ai_prices, public.ai_budgets to authenticated;
drop policy if exists ai_prices_read on public.ai_prices;
create policy ai_prices_read on public.ai_prices for select to authenticated using (public.is_platform());
drop policy if exists ai_budgets_read on public.ai_budgets;
create policy ai_budgets_read on public.ai_budgets for select to authenticated using (public.is_platform());

-- Preço vigente do modelo.
create or replace function public.ai_price(p_model text) returns table (input_per_mtok numeric, output_per_mtok numeric)
language sql stable security definer set search_path = public as $$
  select p.input_per_mtok, p.output_per_mtok from public.ai_prices p where p.model = p_model and p.valid_from <= current_date order by p.valid_from desc limit 1
$$;
revoke execute on function public.ai_price(text) from public, anon, authenticated;

/*
 * Reserva ATÔMICA antes de chamar o provedor. Trava global (plataforma) + por escritório; confere, nesta ordem:
 *  1) OCR ligado e faturamento confirmado (só p/ módulo ocr); 2) teto mensal em US$ da plataforma (inclui reservas);
 *  3) páginas/dia e páginas/mês do escritório (override > plano > plataforma). Devolve id da reserva ou o motivo.
 */
create or replace function public.ai_reserve(p_org uuid, p_module text, p_purpose text, p_model text, p_pages int, p_est_usd numeric, p_version text, p_doc text, p_actor uuid, p_key_owner text default 'plataforma')
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.ai_settings; plat public.ai_budgets; lim public.ai_budgets; plan text; spent numeric; day_pages int; month_pages int; rid bigint;
  m0 timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc'; d0 timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
begin
  perform pg_advisory_xact_lock(hashtext('lexsion-ai-budget'));
  select * into s from public.ai_settings where id;
  if p_module = 'ocr' and (not s.ocr_enabled or s.billing_confirmed_at is null) then return jsonb_build_object('ok', false, 'reason', 'ocr_bloqueado'); end if;
  select * into plat from public.ai_budgets where scope = 'plataforma' and ref = '';
  if plat.scope is null then return jsonb_build_object('ok', false, 'reason', 'sem_orcamento'); end if;
  select coalesce(sum(cost_usd), 0) into spent from public.ai_usage where at >= m0 and status in ('reservado','concluido') and key_owner = 'plataforma';
  -- Chave própria do escritório: o custo é dele; o teto em US$ da plataforma não se aplica (limites de páginas sim).
  if p_key_owner = 'plataforma' and spent + coalesce(p_est_usd, 0) > plat.monthly_usd then return jsonb_build_object('ok', false, 'reason', 'teto_plataforma', 'spent', spent, 'cap', plat.monthly_usd); end if;
  if p_pages > 0 then
    select plan_id into plan from public.saas_subscriptions where organization_id = p_org and status = 'ativa';
    select * into lim from public.ai_budgets where scope = 'escritorio' and ref = p_org::text;
    if lim.scope is null and plan is not null then select * into lim from public.ai_budgets where scope = 'plano' and ref = plan; end if;
    if lim.scope is null then lim := plat; end if;
    select coalesce(sum(pages) filter (where at >= d0), 0), coalesce(sum(pages), 0) into day_pages, month_pages from public.ai_usage where organization_id = p_org and at >= m0 and status in ('reservado','concluido');
    if day_pages + p_pages > coalesce(lim.ocr_pages_day, 0) then return jsonb_build_object('ok', false, 'reason', 'limite_dia', 'used', day_pages, 'limit', lim.ocr_pages_day); end if;
    if month_pages + p_pages > coalesce(lim.ocr_pages_month, 0) then return jsonb_build_object('ok', false, 'reason', 'limite_mes', 'used', month_pages, 'limit', lim.ocr_pages_month); end if;
    -- Teto de páginas da plataforma (todos os escritórios).
    select coalesce(sum(pages), 0) into month_pages from public.ai_usage where at >= m0 and status in ('reservado','concluido');
    if month_pages + p_pages > coalesce(plat.ocr_pages_month, 0) then return jsonb_build_object('ok', false, 'reason', 'teto_paginas_plataforma'); end if;
  end if;
  insert into public.ai_usage (organization_id, actor_id, purpose, module, model, input_chars, output_chars, pages, cost_usd, estimated, status, processing_version, document_ref, key_owner)
    values (p_org, p_actor, p_purpose, p_module, p_model, 0, 0, p_pages, coalesce(p_est_usd, 0), true, 'reservado', p_version, p_doc, case when p_key_owner = 'escritorio' then 'escritorio' else 'plataforma' end) returning id into rid;
  return jsonb_build_object('ok', true, 'id', rid);
end $$;
revoke execute on function public.ai_reserve(uuid, text, text, text, int, numeric, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.ai_reserve(uuid, text, text, text, int, numeric, text, text, uuid, text) to service_role;

-- Acerto com os tokens reais (usageMetadata). Falha: reserva fica com custo 0 e status falha (páginas liberadas).
create or replace function public.ai_settle(p_id bigint, p_ok boolean, p_in int, p_out int, p_latency int) returns numeric
language plpgsql security definer set search_path = public as $$
declare u public.ai_usage; pr record; cost numeric := 0;
begin
  select * into u from public.ai_usage where id = p_id and status = 'reservado' for update;
  if u.id is null then return null; end if;
  if p_ok then
    select * into pr from public.ai_price(u.model);
    cost := round((coalesce(p_in, 0) * coalesce(pr.input_per_mtok, 0) + coalesce(p_out, 0) * coalesce(pr.output_per_mtok, 0)) / 1000000.0, 6);
    update public.ai_usage set status = 'concluido', input_tokens = p_in, output_tokens = p_out, cost_usd = cost, estimated = false, latency_ms = p_latency where id = p_id;
  else
    update public.ai_usage set status = 'falha', pages = 0, cost_usd = 0, latency_ms = p_latency where id = p_id;
  end if;
  return cost;
end $$;
revoke execute on function public.ai_settle(bigint, boolean, int, int, int) from public, anon, authenticated;
grant execute on function public.ai_settle(bigint, boolean, int, int, int) to service_role;

-- Teto da plataforma vale também para os módulos de texto (atendimento, simulador, assistente): checagem sem reserva.
create or replace function public.ai_platform_ok(p_est_usd numeric) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(cost_usd) from public.ai_usage where at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc' and status in ('reservado','concluido') and key_owner = 'plataforma'), 0) + coalesce(p_est_usd, 0)
    <= coalesce((select monthly_usd from public.ai_budgets where scope = 'plataforma' and ref = ''), 0)
$$;
revoke execute on function public.ai_platform_ok(numeric) from public, anon, authenticated;
grant execute on function public.ai_platform_ok(numeric) to service_role;
