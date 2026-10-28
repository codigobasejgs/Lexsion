-- LexSion Intelligence — monitoramento jurídico contínuo. Só ADITIVA.
-- Dados GLOBAIS: apenas informação pública oficial (leitura para usuários autenticados; escrita só pelo servidor).
-- Dados do ESCRITÓRIO (preferências, alertas): organization_id + RLS.

create table if not exists public.legal_source_providers (
  id text primary key,
  name text not null,
  organ text not null,
  coverage text not null,
  status text not null check (status in ('REAL_ATIVA','PARCIAL','AGUARDA_CREDENCIAL','AGUARDA_LICENCA','AGUARDA_REVISAO_JURIDICA','INDISPONIVEL','DEMO')),
  status_note text not null default '',
  terms_url text,
  enabled boolean not null default false,
  frequency_minutes int not null default 180 check (frequency_minutes between 15 and 10080),
  last_run_at timestamptz,
  last_success_at timestamptz,
  next_run_at timestamptz,
  last_error text,
  consecutive_failures int not null default 0,
  circuit_open_until timestamptz,
  sync_lock_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null references public.legal_source_providers(id),
  external_id text not null,
  doc_kind text not null check (doc_kind in ('proposicao','medida_provisoria','norma_publicada','norma_vigente','decisao','ato_administrativo')),
  type_code text not null,            -- PL, PLP, PEC, MPV…
  number text not null,
  title text not null,
  ementa text not null default '',
  organ text not null,
  status_label text not null default '',
  official_url text not null check (official_url ~ '^https://'),
  published_on date,                  -- data oficial de apresentação/publicação na fonte
  effective_from date,                -- vigência (só quando a fonte informa)
  last_event_at timestamptz,          -- data/hora do último ato oficial (tramitação)
  fetched_at timestamptz not null default now(),
  last_confirmed_at timestamptz not null default now(),
  content_hash text not null,
  areas text[] not null default '{}',
  areas_method text not null default 'palavras',
  current_version int not null default 1,
  search tsvector generated always as (to_tsvector('portuguese', coalesce(title,'') || ' ' || coalesce(ementa,'') || ' ' || coalesce(status_label,''))) stored,
  unique (provider_id, external_id)
);
create index if not exists legal_documents_search on public.legal_documents using gin (search);
create index if not exists legal_documents_areas on public.legal_documents using gin (areas);

create table if not exists public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.legal_documents(id) on delete cascade,
  version int not null,
  content_hash text not null,
  ementa text not null default '',
  status_label text not null default '',
  last_event text not null default '',
  last_event_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  unique (document_id, version),
  unique (document_id, content_hash)
);

create table if not exists public.legal_updates (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.legal_documents(id) on delete cascade,
  version_id uuid not null references public.legal_document_versions(id) on delete cascade,
  update_type text not null check (update_type in ('novo','alteracao')),
  detected_at timestamptz not null default now(),
  areas text[] not null default '{}',
  ai_summary text,
  ai_model text,
  analyzed_at timestamptz,
  verified_at timestamptz,            -- revisão humana (nunca preenchido automaticamente)
  unique (version_id)
);
create index if not exists legal_updates_detected on public.legal_updates (detected_at desc);

create table if not exists public.source_sync_runs (
  id bigint generated always as identity primary key,
  provider_id text not null references public.legal_source_providers(id),
  trigger text not null check (trigger in ('cron','manual','teste')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'executando' check (status in ('executando','ok','parcial','erro','bloqueado','ignorado')),
  items_seen int not null default 0,
  items_new int not null default 0,
  items_changed int not null default 0,
  alerts_created int not null default 0,
  latency_ms int,
  error text
);
create index if not exists source_sync_runs_provider on public.source_sync_runs (provider_id, started_at desc);

create table if not exists public.source_sync_cursors (
  provider_id text primary key references public.legal_source_providers(id),
  cursor jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Preferências e alertas por escritório.
create table if not exists public.tenant_legal_preferences (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  areas text[] not null default '{}',
  keywords text[] not null default '{}' check (cardinality(keywords) <= 30),
  include_projects boolean not null default true,
  digest text not null default 'imediato' check (digest in ('imediato','diario','semanal','nenhum')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table if not exists public.tenant_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  update_id uuid not null references public.legal_updates(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, update_id)
);

-- ============ RLS ============
alter table public.legal_source_providers enable row level security;
alter table public.legal_documents enable row level security;
alter table public.legal_document_versions enable row level security;
alter table public.legal_updates enable row level security;
alter table public.source_sync_runs enable row level security;
alter table public.source_sync_cursors enable row level security;
alter table public.tenant_legal_preferences enable row level security;
alter table public.tenant_alerts enable row level security;

-- Fontes oficiais públicas: qualquer usuário autenticado lê; ninguém grava pelo navegador.
do $$ declare t text; begin
  foreach t in array array['legal_documents','legal_document_versions','legal_updates'] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select to authenticated using (true)', t, t);
  end loop;
end $$;
drop policy if exists providers_read on public.legal_source_providers;
create policy providers_read on public.legal_source_providers for select to authenticated using (true);
-- Execuções e cursores: só a plataforma (painel de saúde).
drop policy if exists runs_read on public.source_sync_runs;
create policy runs_read on public.source_sync_runs for select to authenticated using (public.is_platform());
drop policy if exists cursors_read on public.source_sync_cursors;
create policy cursors_read on public.source_sync_cursors for select to authenticated using (public.is_platform());

drop policy if exists prefs_read on public.tenant_legal_preferences;
create policy prefs_read on public.tenant_legal_preferences for select to authenticated using (public.is_member(organization_id));
drop policy if exists prefs_write on public.tenant_legal_preferences;
create policy prefs_write on public.tenant_legal_preferences for all to authenticated
  using (public.has_role(organization_id, array['admin','tenant_admin','advogado']))
  with check (public.has_role(organization_id, array['admin','tenant_admin','advogado']));
drop policy if exists alerts_read on public.tenant_alerts;
create policy alerts_read on public.tenant_alerts for select to authenticated using (public.is_member(organization_id));

revoke all on public.legal_source_providers, public.legal_documents, public.legal_document_versions, public.legal_updates, public.source_sync_runs, public.source_sync_cursors, public.tenant_alerts, public.tenant_legal_preferences from anon, authenticated;
grant select on public.legal_source_providers, public.legal_documents, public.legal_document_versions, public.legal_updates, public.source_sync_runs, public.source_sync_cursors, public.tenant_alerts to authenticated;
grant select, insert, update, delete on public.tenant_legal_preferences to authenticated;

-- Trava por fonte: impede duas execuções simultâneas (cron + manual).
create or replace function public.acquire_sync_lock(p_provider text, p_seconds int) returns boolean
language sql security definer set search_path = public as $$
  update public.legal_source_providers set sync_lock_until = now() + make_interval(secs => p_seconds)
  where id = p_provider and (sync_lock_until is null or sync_lock_until < now())
  returning true
$$;
revoke execute on function public.acquire_sync_lock(text, int) from public, anon, authenticated;

-- ============ Catálogo de fontes (estado verdadeiro em 28/10/2026) ============
insert into public.legal_source_providers (id, name, organ, coverage, status, status_note, terms_url, enabled, frequency_minutes) values
 ('camara-proposicoes', 'Câmara dos Deputados — Dados Abertos', 'Câmara dos Deputados', 'Proposições (PL, PLP, PEC, PDL) e medidas provisórias com tramitação recente; situação e último ato', 'REAL_ATIVA', 'API REST pública documentada. Proposição em tramitação NÃO é norma em vigor.', 'https://dadosabertos.camara.leg.br/swagger/api.html', true, 180),
 ('senado-materias', 'Senado Federal — Dados Abertos', 'Senado Federal', 'Matérias legislativas atualizadas', 'PARCIAL', 'Serviço documentado; a rede de teste recebeu limite de requisições (HTTP 429). Conector a ativar após coleta comprovada a partir da produção.', 'https://www12.senado.leg.br/dados-abertos', false, 360),
 ('planalto-legislacao', 'Planalto — Portal da Legislação', 'Presidência da República', 'Leis, decretos e medidas provisórias publicados', 'INDISPONIVEL', 'Não há API oficial documentada; o portal não respondeu aos testes. Raspagem de páginas não é usada.', 'https://www4.planalto.gov.br/legislacao/portal-legis/busca-avancada', false, 1440),
 ('lexml', 'LexML Brasil', 'Senado Federal / Rede LexML', 'Normas federais, estaduais e municipais (metadados)', 'INDISPONIVEL', 'Serviço SRU exige verificação anti-robô; acesso automatizado não autorizado.', 'https://www.lexml.gov.br/', false, 1440),
 ('dou-inlabs', 'Diário Oficial da União — INLABS', 'Imprensa Nacional', 'Atos normativos e portarias publicados no DOU', 'AGUARDA_CREDENCIAL', 'Leitura automatizada exige cadastro e login no INLABS; serviço estava em manutenção no teste.', 'https://inlabs.in.gov.br/', false, 1440),
 ('previdencia-inss', 'Ministério da Previdência / INSS / CRPS', 'Ministério da Previdência Social', 'Portarias, instruções normativas e notícias oficiais', 'INDISPONIVEL', 'Sem feed ou API oficial localizado (RSS testado responde 404). Atos previdenciários chegam pelo DOU quando o INLABS for credenciado.', 'https://www.gov.br/previdencia/pt-br', false, 1440),
 ('datajud-cnj', 'DataJud — CNJ', 'Conselho Nacional de Justiça', 'Metadados de processos (capa e movimentos)', 'AGUARDA_LICENCA', 'API responde, mas o termo de uso (itens 3.3 e 3.8) veda uso comercial e exploração de informação derivada. Exige autorização do CNJ ou parecer jurídico.', 'https://datajud-wiki.cnj.jus.br/api-publica/termo-uso/', false, 1440),
 ('jurisprudencia-tribunais', 'STF, STJ, TRFs, TJs, CJF — jurisprudência', 'Tribunais', 'Precedentes e decisões', 'AGUARDA_LICENCA', 'Sem API pública oficial unificada com permissão de uso em SaaS; depende de fornecedor com contrato.', null, false, 1440),
 ('jusbrasil-api', 'Jusbrasil Soluções (API)', 'Jusbrasil (privado)', 'Jurisprudência, diários e processos', 'AGUARDA_LICENCA', 'Somente por contrato de API que permita uso no SaaS. Credenciais pessoais de usuário não são usadas.', null, false, 1440),
 ('previdenciarista', 'Previdenciarista / IntelPrev / Cálculo Jurídico', 'Fornecedores privados', 'Cálculos e conteúdo previdenciário', 'AGUARDA_LICENCA', 'Sem API contratual com sublicenciamento; login de usuário não é usado.', null, false, 10080)
on conflict (id) do update set name = excluded.name, organ = excluded.organ, coverage = excluded.coverage, status_note = excluded.status_note, terms_url = excluded.terms_url;
