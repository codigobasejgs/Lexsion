-- Fase 2/3: séries oficiais (BCB/IBGE) e precedentes qualificados do STJ (dados abertos, CC-BY).
-- Tabelas GLOBAIS (sem dado de escritório): qualquer membro autenticado lê; só o servidor grava.

create table if not exists public.official_series (
  series text not null check (series in ('inpc','ipca','ipcae','igpm','igpdi','selic','tr','taxaLegal','salarioMinimo')),
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  value numeric(14,6) not null,
  source_url text not null check (source_url ~ '^https://'),
  fetched_at timestamptz not null default now(),
  primary key (series, month)
);
alter table public.official_series enable row level security;
drop policy if exists official_series_read on public.official_series;
create policy official_series_read on public.official_series for select to authenticated using (true);
revoke all on public.official_series from anon;
revoke insert, update, delete, truncate on public.official_series from authenticated;
grant select on public.official_series to authenticated;

create table if not exists public.legal_precedents (
  id text primary key,                     -- 'stj-tema-1102', 'stj-iac-17'…
  court text not null default 'STJ',
  kind text not null,                      -- Tema, IAC, PUIL, SIRDR, Controvérsia
  number text not null,
  situation text not null default '',
  question text not null default '',
  thesis text not null default '',
  subjects text not null default '',
  legislation text not null default '',
  judged_on date,
  published_on date,
  areas text[] not null default '{}',
  official_url text not null check (official_url ~ '^https://'),
  source_dataset text not null,
  content_hash text not null,
  fetched_at timestamptz not null default now(),
  search tsvector generated always as (to_tsvector('portuguese', coalesce(question,'') || ' ' || coalesce(thesis,'') || ' ' || coalesce(subjects,'') || ' ' || coalesce(legislation,''))) stored
);
create index if not exists legal_precedents_search on public.legal_precedents using gin (search);
create index if not exists legal_precedents_areas on public.legal_precedents using gin (areas);
alter table public.legal_precedents enable row level security;
drop policy if exists legal_precedents_read on public.legal_precedents;
create policy legal_precedents_read on public.legal_precedents for select to authenticated using (true);
revoke all on public.legal_precedents from anon;
revoke insert, update, delete, truncate on public.legal_precedents from authenticated;
grant select on public.legal_precedents to authenticated;

-- Provedores no mesmo painel de saúde das fontes (Super Admin).
insert into public.legal_source_providers (id, name, organ, coverage, status, status_note, terms_url, enabled, frequency_minutes) values
 ('bcb-sgs', 'Banco Central — Séries temporais (SGS)', 'Banco Central do Brasil', 'INPC, IPCA, IPCA-E, IGP-M, IGP-DI, Selic, TR, taxa legal e salário mínimo', 'REAL_ATIVA', 'API pública documentada. IPC-r (1994–1995) e tábua de mortalidade vêm do IBGE, versionados no código.', 'https://dadosabertos.bcb.gov.br/', true, 1440),
 ('stj-precedentes', 'STJ — Precedentes qualificados', 'Superior Tribunal de Justiça', 'Temas repetitivos, IAC, PUIL, SIRDR e controvérsias: questão, tese, situação e legislação', 'REAL_ATIVA', 'Portal de dados abertos do STJ, licença CC-BY. Texto integral dos acórdãos fica no portal oficial (link).', 'https://dadosabertos.web.stj.jus.br/dataset/precedentes-qualificados', true, 10080)
on conflict (id) do nothing;

-- Agendamento: uma chamada diária à rota de fontes oficiais (mesmo segredo do Vault das outras rotas).
create or replace function public.trigger_official_sync() returns bigint
language plpgsql security definer set search_path = public, extensions, vault as $$
declare secret text; target text; req bigint;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'lexsion_cron_secret';
  select replace(decrypted_secret, '/api/cron/inteligencia', '/api/cron/fontes-oficiais') into target from vault.decrypted_secrets where name = 'lexsion_cron_url';
  if secret is null or target is null then raise exception 'segredo ou URL do cron não configurados no Vault'; end if;
  select net.http_get(url := target, headers := jsonb_build_object('Authorization', 'Bearer ' || secret), timeout_milliseconds := 290000) into req;
  return req;
end $$;
revoke execute on function public.trigger_official_sync() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'lexsion-fontes-oficiais') then perform cron.unschedule('lexsion-fontes-oficiais'); end if;
    perform cron.schedule('lexsion-fontes-oficiais', '37 10 * * *', 'select public.trigger_official_sync()'); -- 07:37 em Brasília
end $$;
