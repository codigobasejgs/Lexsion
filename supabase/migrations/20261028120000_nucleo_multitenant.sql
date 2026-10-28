-- LexSion — núcleo multi-tenant (Onda 1). Idempotente onde possível; RLS em todas as tabelas expostas.
-- Autorização: o servidor valida a sessão; o Postgres REAFIRMA com RLS a partir de auth.uid() (nunca do organization_id enviado).

-- ============ Plataforma e escritórios ============
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9](-?[a-z0-9])*$' and length(slug) between 3 and 40),
  name text not null check (length(name) between 2 and 160),
  status text not null default 'trial' check (status in ('ativa','trial','suspensa','inadimplente','cancelada')),
  plan text not null default 'trial',
  branding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('superadmin','platform_admin','platform_support')),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

-- Papéis do escritório (mesmos de src/domain/permissions.ts).
create table if not exists public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','tenant_admin','advogado','controladoria','financeiro','atendimento','estagiario','external_collaborator')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- ============ Funções de autorização (security definer, search_path fixo) ============
create or replace function public.is_member(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_memberships m where m.organization_id = org and m.user_id = auth.uid())
$$;

create or replace function public.has_role(org uuid, roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_memberships m where m.organization_id = org and m.user_id = auth.uid() and m.role = any(roles))
$$;

create or replace function public.is_platform(roles text[] default array['superadmin','platform_admin','platform_support']) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_members p where p.user_id = auth.uid() and p.role = any(roles))
$$;

-- ============ Clientes, portal, casos ============
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('PF','PJ')),
  name text not null check (length(name) between 2 and 200),
  document text not null check (document ~ '^\d{11}$|^\d{14}$'),
  email text,
  phone text,
  birth_date date,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  version int not null default 1,
  unique (organization_id, document)
);
create index if not exists clients_org_idx on public.clients (organization_id);

create table if not exists public.client_portal_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  primary key (user_id, client_id)
);

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  title text not null check (length(title) between 3 and 200),
  area text not null,
  phase text not null default 'triagem' check (phase in ('triagem','documentacao','analise','administrativo','judicial','cumprimento','encerrado')),
  cnj text check (cnj is null or cnj ~ '^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$'),
  owner_id uuid references auth.users(id),
  confidential boolean not null default false,
  created_at timestamptz not null default now(),
  version int not null default 1
);
create index if not exists cases_org_idx on public.cases (organization_id);
create index if not exists cases_client_idx on public.cases (client_id);

-- Consistência: cliente do caso pertence ao mesmo escritório (impede FK cruzada entre tenants).
create or replace function public.check_same_org_case() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.clients c where c.id = new.client_id and c.organization_id = new.organization_id) then
    raise exception 'cliente de outro escritório' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists cases_same_org on public.cases;
create trigger cases_same_org before insert or update on public.cases for each row execute function public.check_same_org_case();

create table if not exists public.portal_updates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  text text not null check (length(text) >= 10),
  next_step text not null,
  status text not null default 'rascunho' check (status in ('rascunho','publicada')),
  created_by uuid references auth.users(id),
  published_by uuid references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  title text not null,
  assignee_id uuid references auth.users(id),
  due date not null,
  done boolean not null default false,
  depends_on uuid references public.tasks(id),
  created_at timestamptz not null default now()
);
create index if not exists tasks_org_idx on public.tasks (organization_id);

-- Documento: metadados no banco, arquivo no Storage privado em <organization_id>/<document_id>/<nome>.
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  name text not null,
  doc_type text not null,
  storage_path text,
  mime text check (mime is null or mime in ('application/pdf','image/jpeg','image/png','image/webp')),
  size_bytes bigint check (size_bytes is null or size_bytes between 1 and 15728640),
  shared_with_client boolean not null default false,
  status text not null default 'solicitado' check (status in ('solicitado','recebido','em_leitura','precisa_revisar','validado','rejeitado')),
  created_at timestamptz not null default now()
);
create index if not exists documents_org_idx on public.documents (organization_id);

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  title text not null,
  body text not null default '',
  status text not null default 'rascunho' check (status in ('rascunho','revisao','ajustes','aprovado','exportado')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  version int not null default 1,
  updated_at timestamptz not null default now()
);

-- Auditoria append-only.
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text not null,
  detail text,
  at timestamptz not null default now()
);
create index if not exists audit_org_idx on public.audit_logs (organization_id, at desc);

create or replace function public.audit_row() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  r := coalesce(new, old);
  insert into public.audit_logs (organization_id, actor_id, action, entity, entity_id)
  values (r.organization_id, auth.uid(), lower(tg_op), tg_table_name, r.id::text);
  return coalesce(new, old);
end $$;
do $$ declare t text; begin
  foreach t in array array['clients','cases','documents','drafts','portal_updates','tasks'] loop
    execute format('drop trigger if exists %I_audit on public.%I', t, t);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row()', t, t);
  end loop;
end $$;

-- ============ RLS ============
alter table public.organizations enable row level security;
alter table public.platform_members enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.clients enable row level security;
alter table public.client_portal_access enable row level security;
alter table public.cases enable row level security;
alter table public.portal_updates enable row level security;
alter table public.tasks enable row level security;
alter table public.documents enable row level security;
alter table public.drafts enable row level security;
alter table public.audit_logs enable row level security;

-- Escritórios: membro lê o próprio; plataforma lê todos (dados agregados ficam em views próprias).
drop policy if exists org_read on public.organizations;
create policy org_read on public.organizations for select to authenticated using (public.is_member(id) or public.is_platform());
drop policy if exists org_admin_update on public.organizations;
create policy org_admin_update on public.organizations for update to authenticated using (public.has_role(id, array['admin'])) with check (public.has_role(id, array['admin']));

drop policy if exists platform_self on public.platform_members;
create policy platform_self on public.platform_members for select to authenticated using (user_id = auth.uid());

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select to authenticated using (user_id = auth.uid() or exists (select 1 from public.organization_memberships a join public.organization_memberships b on a.organization_id = b.organization_id where a.user_id = auth.uid() and b.user_id = profiles.user_id));
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists memb_read on public.organization_memberships;
create policy memb_read on public.organization_memberships for select to authenticated using (public.is_member(organization_id));
drop policy if exists memb_admin on public.organization_memberships;
create policy memb_admin on public.organization_memberships for all to authenticated using (public.has_role(organization_id, array['admin','tenant_admin'])) with check (public.has_role(organization_id, array['admin','tenant_admin']));

-- Equipe interna (exceto correspondente externo) vê clientes; cliente do portal vê só o próprio cadastro.
drop policy if exists clients_team on public.clients;
create policy clients_team on public.clients for all to authenticated
  using (public.has_role(organization_id, array['admin','tenant_admin','advogado','controladoria','financeiro','atendimento','estagiario']))
  with check (public.has_role(organization_id, array['admin','tenant_admin','advogado','controladoria','atendimento','estagiario']));
drop policy if exists clients_portal on public.clients;
create policy clients_portal on public.clients for select to authenticated using (exists (select 1 from public.client_portal_access p where p.user_id = auth.uid() and p.client_id = clients.id));

drop policy if exists portal_access_self on public.client_portal_access;
create policy portal_access_self on public.client_portal_access for select to authenticated using (user_id = auth.uid() or public.has_role(organization_id, array['admin','tenant_admin','advogado']));
drop policy if exists portal_access_admin on public.client_portal_access;
create policy portal_access_admin on public.client_portal_access for insert to authenticated with check (public.has_role(organization_id, array['admin','tenant_admin','advogado']));

-- Casos sigilosos: só titular, advogado(a) ou responsável.
drop policy if exists cases_team on public.cases;
create policy cases_team on public.cases for select to authenticated using (
  public.has_role(organization_id, array['admin','tenant_admin','advogado','controladoria','financeiro','atendimento','estagiario'])
  and (not confidential or owner_id = auth.uid() or public.has_role(organization_id, array['admin','advogado'])));
drop policy if exists cases_write on public.cases;
create policy cases_write on public.cases for insert to authenticated with check (public.has_role(organization_id, array['admin','tenant_admin','advogado','controladoria','atendimento']));
drop policy if exists cases_update on public.cases;
create policy cases_update on public.cases for update to authenticated using (public.has_role(organization_id, array['admin','tenant_admin','advogado','controladoria'])) with check (public.has_role(organization_id, array['admin','tenant_admin','advogado','controladoria']));
drop policy if exists cases_portal on public.cases;
create policy cases_portal on public.cases for select to authenticated using (exists (select 1 from public.client_portal_access p where p.user_id = auth.uid() and p.client_id = cases.client_id));

-- Portal: equipe vê tudo do escritório; cliente só atualizações PUBLICADAS dos próprios casos.
drop policy if exists pu_team on public.portal_updates;
create policy pu_team on public.portal_updates for select to authenticated using (public.has_role(organization_id, array['admin','tenant_admin','advogado','controladoria','atendimento','estagiario']));
drop policy if exists pu_draft on public.portal_updates;
create policy pu_draft on public.portal_updates for insert to authenticated with check (status = 'rascunho' and public.has_role(organization_id, array['admin','tenant_admin','advogado','controladoria','atendimento','estagiario']));
drop policy if exists pu_client on public.portal_updates;
create policy pu_client on public.portal_updates for select to authenticated using (status = 'publicada' and exists (select 1 from public.cases c join public.client_portal_access p on p.client_id = c.client_id where c.id = portal_updates.case_id and p.user_id = auth.uid()));
-- Publicar NÃO é update livre: só pela função publish_portal_update (papel verificado).

drop policy if exists tasks_team on public.tasks;
create policy tasks_team on public.tasks for all to authenticated using (public.is_member(organization_id)) with check (public.is_member(organization_id));

drop policy if exists docs_team on public.documents;
create policy docs_team on public.documents for all to authenticated
  using (public.has_role(organization_id, array['admin','tenant_admin','advogado','controladoria','atendimento','estagiario']))
  with check (public.has_role(organization_id, array['admin','tenant_admin','advogado','controladoria','atendimento','estagiario']));
drop policy if exists docs_client on public.documents;
create policy docs_client on public.documents for select to authenticated using (shared_with_client and exists (select 1 from public.client_portal_access p where p.user_id = auth.uid() and p.client_id = documents.client_id));

drop policy if exists drafts_team on public.drafts;
create policy drafts_team on public.drafts for select to authenticated using (public.has_role(organization_id, array['admin','tenant_admin','advogado','controladoria','estagiario']));
drop policy if exists drafts_write on public.drafts;
create policy drafts_write on public.drafts for insert to authenticated with check (status = 'rascunho' and public.has_role(organization_id, array['admin','tenant_admin','advogado','controladoria','estagiario']));
drop policy if exists drafts_edit on public.drafts;
-- Edição de texto não pode aprovar: status de aprovação só pela função approve_draft.
create policy drafts_edit on public.drafts for update to authenticated
  using (public.has_role(organization_id, array['admin','tenant_admin','advogado','controladoria','estagiario']))
  with check (status in ('rascunho','revisao','ajustes') and approved_by is null);

drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select to authenticated using (public.has_role(organization_id, array['admin']) or public.is_platform(array['superadmin','platform_admin']));
-- Sem policy de insert/update/delete: append-only via trigger security definer.

-- ============ Operações privilegiadas (papel verificado no banco) ============
create or replace function public.approve_draft(p_draft uuid, p_expected_version int) returns public.drafts
language plpgsql security definer set search_path = public as $$
declare d public.drafts;
begin
  select * into d from public.drafts where id = p_draft for update;
  if d.id is null or not public.is_member(d.organization_id) then raise exception 'minuta não encontrada' using errcode = 'P0002'; end if;
  if not public.has_role(d.organization_id, array['admin','advogado']) then raise exception 'somente advogado(a) ou titular aprova' using errcode = '42501'; end if;
  if d.version <> p_expected_version then raise exception 'minuta alterada por outra pessoa (versão %)', d.version using errcode = '40001'; end if;
  if d.body ~ '\[[\w.]+ — não preenchido\]' then raise exception 'há campos não preenchidos' using errcode = '23514'; end if;
  update public.drafts set status = 'aprovado', approved_by = auth.uid(), approved_at = now(), version = version + 1, updated_at = now() where id = p_draft returning * into d;
  return d;
end $$;

create or replace function public.publish_portal_update(p_update uuid) returns public.portal_updates
language plpgsql security definer set search_path = public as $$
declare u public.portal_updates;
begin
  select * into u from public.portal_updates where id = p_update for update;
  if u.id is null or not public.is_member(u.organization_id) then raise exception 'atualização não encontrada' using errcode = 'P0002'; end if;
  if not public.has_role(u.organization_id, array['admin','advogado']) then raise exception 'somente advogado(a) ou titular publica no portal' using errcode = '42501'; end if;
  if u.status = 'publicada' then return u; end if; -- idempotente
  update public.portal_updates set status = 'publicada', published_by = auth.uid(), published_at = now() where id = p_update returning * into u;
  return u;
end $$;

-- Criação de escritório: só a plataforma; o titular vira membro "admin".
create or replace function public.create_organization(p_slug text, p_name text, p_owner uuid) returns public.organizations
language plpgsql security definer set search_path = public as $$
declare o public.organizations;
begin
  if not public.is_platform(array['superadmin','platform_admin']) then raise exception 'somente a plataforma cria escritórios' using errcode = '42501'; end if;
  if p_slug in ('admin','app','api','www','portal','demo','lexsion') then raise exception 'endereço reservado' using errcode = '23514'; end if;
  insert into public.organizations (slug, name) values (p_slug, p_name) returning * into o;
  insert into public.organization_memberships (organization_id, user_id, role) values (o.id, p_owner, 'admin');
  return o;
end $$;

-- ============ Privilégios mínimos ============
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.clients, public.cases, public.tasks, public.documents, public.drafts, public.portal_updates, public.organization_memberships to authenticated;
grant select on public.organizations, public.platform_members, public.profiles, public.audit_logs, public.client_portal_access to authenticated;
grant update on public.organizations, public.profiles to authenticated;
grant insert on public.client_portal_access to authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_member(uuid), public.has_role(uuid, text[]), public.is_platform(text[]), public.approve_draft(uuid, int), public.publish_portal_update(uuid), public.create_organization(text, text, uuid) to authenticated;

-- ============ Storage privado ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 15728640, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Caminho obrigatório: <organization_id>/<...>. Equipe do escritório lê/grava; cliente lê só arquivo de documento compartilhado.
drop policy if exists docs_storage_team on storage.objects;
create policy docs_storage_team on storage.objects for all to authenticated
  using (bucket_id = 'documentos' and public.has_role(((storage.foldername(name))[1])::uuid, array['admin','tenant_admin','advogado','controladoria','atendimento','estagiario']))
  with check (bucket_id = 'documentos' and public.has_role(((storage.foldername(name))[1])::uuid, array['admin','tenant_admin','advogado','controladoria','atendimento','estagiario']));
drop policy if exists docs_storage_client on storage.objects;
create policy docs_storage_client on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and exists (select 1 from public.documents d join public.client_portal_access p on p.client_id = d.client_id where d.storage_path = storage.objects.name and d.shared_with_client and p.user_id = auth.uid()));
