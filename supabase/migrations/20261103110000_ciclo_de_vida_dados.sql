-- Ciclo de vida dos dados do escritório (Anexo III.10–III.12) e perfil de atuação (onboarding por especialidade).
-- ADITIVA: só cria tabelas, colunas e funções; nenhum dado existente é alterado ou apagado por esta migration.
-- Regras:
--  * exportação integral: só o TITULAR (admin) do próprio escritório; registro de pedido/resultado/download;
--  * eliminação: NUNCA automática nem em massa. Só o PROPRIETÁRIO da plataforma (superadmin), por escritório,
--    90 dias após o encerramento efetivo, com prévia, motivo, digitação do endereço do escritório e senha
--    reconferida no servidor. Arquivos do Storage saem antes (pelo servidor); o banco sai em uma transação;
--  * o que fica (por obrigação legal/exercício de direitos): contratos SaaS e aceites, pedidos/pagamentos, a
--    própria trilha de eliminação e o registro de incidentes. Os backups cifrados expiram pelo ciclo de 30 cópias;
--  * incidentes: registro auditável só da plataforma (operação), sem conteúdo jurídico.
-- Reversão: drop das tabelas e funções criadas aqui; a coluna organizations.closed_at pode ficar (nula).

-- 1) Data de encerramento efetivo (início do prazo de 90 dias).
alter table public.organizations add column if not exists closed_at timestamptz;

-- 2) Perfil de atuação do escritório (especialidades, modelo de atuação, estrutura, rotina, módulos desejados).
create table if not exists public.org_practice_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  primary_area text,
  areas text[] not null default '{}',
  subareas text[] not null default '{}',
  custom_areas text[] not null default '{}',
  practice_models text[] not null default '{}',
  structure text,
  position text,
  routine jsonb not null default '{}'::jsonb,
  modules text[] not null default '{}',
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.org_practice_profiles enable row level security;
drop policy if exists opp_read on public.org_practice_profiles;
create policy opp_read on public.org_practice_profiles for select to authenticated using (public.is_member(organization_id) or public.is_platform());
drop policy if exists opp_write on public.org_practice_profiles;
create policy opp_write on public.org_practice_profiles for insert to authenticated with check (public.has_role(organization_id, array['admin','tenant_admin']));
drop policy if exists opp_update on public.org_practice_profiles;
create policy opp_update on public.org_practice_profiles for update to authenticated using (public.has_role(organization_id, array['admin','tenant_admin'])) with check (public.has_role(organization_id, array['admin','tenant_admin']));
revoke all on public.org_practice_profiles from anon, authenticated;
grant select, insert, update on public.org_practice_profiles to authenticated;

create or replace function public.opp_guard() returns trigger language plpgsql set search_path = public as $$
declare allowed text[] := array['civil','familia','criminal','trabalhista','tributario','empresarial','consumidor','previdenciario','ambiental','digital','eleitoral','imobiliario','propriedade_intelectual'];
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if not (new.areas <@ allowed) then raise exception 'especialidade fora do catálogo' using errcode = '23514'; end if;
  if new.primary_area is not null and not (new.primary_area = any(new.areas)) then raise exception 'a especialidade principal precisa estar entre as escolhidas' using errcode = '23514'; end if;
  if cardinality(new.custom_areas) > 20 or exists (select 1 from unnest(new.custom_areas) x where length(x) not between 2 and 60) then raise exception 'áreas personalizadas: até 20, com 2 a 60 caracteres' using errcode = '23514'; end if;
  if cardinality(new.subareas) > 80 or cardinality(new.modules) > 60 or cardinality(new.practice_models) > 20 then raise exception 'seleção grande demais' using errcode = '23514'; end if;
  return new;
end $$;
drop trigger if exists opp_guard on public.org_practice_profiles;
create trigger opp_guard before insert or update on public.org_practice_profiles for each row execute function public.opp_guard();
revoke execute on function public.opp_guard() from public, anon, authenticated;

-- 3) Exportações integrais do escritório.
create table if not exists public.data_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  status text not null default 'processando' check (status in ('processando','pronto','falhou')),
  storage_path text,
  bytes bigint,
  sha256 text,
  files int,
  records int,
  error text,
  finished_at timestamptz,
  downloads int not null default 0,
  last_download_at timestamptz
);
create index if not exists data_exports_org on public.data_exports (organization_id, requested_at desc);
alter table public.data_exports enable row level security;
drop policy if exists dx_read on public.data_exports;
create policy dx_read on public.data_exports for select to authenticated using (public.has_role(organization_id, array['admin']) or public.is_platform(array['superadmin','platform_admin']));
revoke all on public.data_exports from anon, authenticated;
grant select on public.data_exports to authenticated;

-- Bucket privado separado (exportações expiram: o servidor apaga o arquivo depois de 7 dias).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exportacoes', 'exportacoes', false, 52428800, array['application/zip'])
on conflict (id) do nothing;

-- 4) Eliminações (trilha permanente: não referencia a organização, que deixa de existir).
create table if not exists public.data_erasures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  org_slug text not null,
  org_name text not null,
  closed_at timestamptz not null,
  eligible_at timestamptz not null,
  requested_by uuid not null,
  reason text not null check (length(trim(reason)) >= 10),
  preview jsonb not null,
  status text not null default 'arquivos_removidos' check (status in ('arquivos_removidos','concluida','falhou')),
  storage_removed int not null default 0,
  storage_failed int not null default 0,
  db_removed jsonb,
  retained jsonb,
  pending jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text
);
alter table public.data_erasures enable row level security;
drop policy if exists de_read on public.data_erasures;
create policy de_read on public.data_erasures for select to authenticated using (public.is_platform(array['superadmin','platform_admin','platform_auditor']));
revoke all on public.data_erasures from anon, authenticated;
grant select on public.data_erasures to authenticated;
create or replace function public.data_erasures_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'trilha de eliminação é permanente' using errcode = '42501'; end if;
  -- Só o servidor completa o registro (status/resultado); identidade, motivo e prévia não mudam.
  if new.organization_id <> old.organization_id or new.requested_by <> old.requested_by or new.reason <> old.reason or new.preview <> old.preview or new.closed_at <> old.closed_at then
    raise exception 'campos do pedido de eliminação são imutáveis' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists data_erasures_guard on public.data_erasures;
create trigger data_erasures_guard before update or delete on public.data_erasures for each row execute function public.data_erasures_guard();
revoke execute on function public.data_erasures_guard() from public, anon, authenticated;

-- 5) Incidentes de segurança (registro da operação; comunicação ao titular em até 1 dia útil — Anexo III.10).
create table if not exists public.security_incidents (
  id uuid primary key default gen_random_uuid(),
  detected_at timestamptz not null,
  known_at timestamptz not null,
  title text not null check (length(trim(title)) >= 5),
  description text not null default '',
  affected_orgs uuid[] not null default '{}',
  data_categories text[] not null default '{}',
  containment text not null default '',
  status text not null default 'aberto' check (status in ('aberto','contido','encerrado')),
  notify_deadline timestamptz not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create table if not exists public.security_incident_updates (
  id bigint generated always as identity primary key,
  incident_id uuid not null references public.security_incidents(id) on delete restrict,
  at timestamptz not null default now(),
  actor_id uuid not null default auth.uid(),
  kind text not null check (kind in ('atualizacao','contencao','comunicacao_titular','encerramento')),
  text text not null check (length(trim(text)) >= 5),
  notified_orgs uuid[] not null default '{}'
);
alter table public.security_incidents enable row level security;
alter table public.security_incident_updates enable row level security;
drop policy if exists si_read on public.security_incidents;
create policy si_read on public.security_incidents for select to authenticated using (public.is_platform(array['superadmin','platform_admin','platform_auditor']));
drop policy if exists si_insert on public.security_incidents;
create policy si_insert on public.security_incidents for insert to authenticated with check (public.is_platform(array['superadmin','platform_admin']));
drop policy if exists si_update on public.security_incidents;
create policy si_update on public.security_incidents for update to authenticated using (public.is_platform(array['superadmin','platform_admin'])) with check (public.is_platform(array['superadmin','platform_admin']));
drop policy if exists siu_read on public.security_incident_updates;
create policy siu_read on public.security_incident_updates for select to authenticated using (public.is_platform(array['superadmin','platform_admin','platform_auditor']));
drop policy if exists siu_insert on public.security_incident_updates;
create policy siu_insert on public.security_incident_updates for insert to authenticated with check (public.is_platform(array['superadmin','platform_admin']));
revoke all on public.security_incidents, public.security_incident_updates from anon, authenticated;
grant select, insert, update (status, containment, description, affected_orgs, data_categories) on public.security_incidents to authenticated;
grant select, insert on public.security_incident_updates to authenticated;
drop trigger if exists siu_append_only on public.security_incident_updates;
create trigger siu_append_only before update or delete on public.security_incident_updates for each row execute function public.saas_append_only();

-- Prazo de 1 dia útil (seg–sex; feriados nacionais não são considerados — o texto do contrato diz "dia útil" e a
-- equipe confirma). Calculado no banco para não depender do relógio do navegador.
create or replace function public.next_business_day(p timestamptz) returns timestamptz language sql immutable as $$
  select p + case extract(isodow from p at time zone 'America/Sao_Paulo')::int when 5 then interval '3 days' when 6 then interval '2 days' else interval '1 day' end
$$;
create or replace function public.si_defaults() returns trigger language plpgsql set search_path = public as $$
begin
  new.notify_deadline := public.next_business_day(new.known_at);
  if new.known_at < new.detected_at then raise exception 'conhecimento não pode ser anterior à detecção' using errcode = '23514'; end if;
  return new;
end $$;
drop trigger if exists si_defaults on public.security_incidents;
create trigger si_defaults before insert on public.security_incidents for each row execute function public.si_defaults();
revoke execute on function public.si_defaults() from public, anon, authenticated;

-- 6) Encerramento efetivo: grava closed_at quando o escritório passa a cancelada (cron no fim do período pago,
--    Super Admin ou titular). Reativação limpa a data.
create or replace function public.org_closed_at() returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'cancelada' and old.status is distinct from 'cancelada' then new.closed_at := coalesce(new.closed_at, now());
  elsif new.status <> 'cancelada' then new.closed_at := null; end if;
  return new;
end $$;
drop trigger if exists org_closed_at on public.organizations;
create trigger org_closed_at before update of status on public.organizations for each row execute function public.org_closed_at();
revoke execute on function public.org_closed_at() from public, anon, authenticated;
-- Escritórios já cancelados antes desta migration: marco = última atualização (nenhum existe hoje em produção).
update public.organizations set closed_at = updated_at where status = 'cancelada' and closed_at is null;

-- 7) Lista de elegíveis + prévia do que sai e do que fica (só metadados e contagens, sem conteúdo jurídico).
create or replace function public.platform_erasure_preview(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o public.organizations;
begin
  if not public.is_platform(array['superadmin','platform_admin','platform_auditor']) then raise exception 'somente a plataforma' using errcode = '42501'; end if;
  select * into o from public.organizations where id = p_org;
  if o.id is null then raise exception 'escritório não encontrado' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'org', jsonb_build_object('id', o.id, 'slug', o.slug, 'name', o.name, 'status', o.status, 'closed_at', o.closed_at, 'eligible_at', o.closed_at + interval '90 days',
      'eligible', o.status = 'cancelada' and o.closed_at is not null and o.closed_at + interval '90 days' <= now()),
    'remove', jsonb_build_object(
      'registros_operacionais', (select count(*) from public.org_records where organization_id = p_org),
      'clientes', (select count(*) from public.clients where organization_id = p_org),
      'casos', (select count(*) from public.cases where organization_id = p_org),
      'documentos', (select count(*) from public.documents where organization_id = p_org),
      'tarefas', (select count(*) from public.tasks where organization_id = p_org),
      'minutas', (select count(*) from public.drafts where organization_id = p_org),
      'atualizacoes_portal', (select count(*) from public.portal_updates where organization_id = p_org),
      'vinculos_equipe', (select count(*) from public.organization_memberships where organization_id = p_org),
      'acessos_portal', (select count(*) from public.client_portal_access where organization_id = p_org),
      'whatsapp', (select count(*) from public.whatsapp_instances where organization_id = p_org),
      'uso_ia', (select count(*) from public.ai_usage where organization_id = p_org),
      'exportacoes', (select count(*) from public.data_exports where organization_id = p_org),
      'trilha_auditoria_escritorio', (select count(*) from public.audit_logs where organization_id = p_org),
      'arquivos_documentos', (select count(*) from storage.objects where bucket_id = 'documentos' and name like p_org::text || '/%'),
      'bytes_documentos', (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects where bucket_id = 'documentos' and name like p_org::text || '/%'),
      'arquivos_marca', (select count(*) from storage.objects where bucket_id = 'marcas' and name like 'slug-' || o.slug || '/%'),
      'arquivos_exportacao', (select count(*) from storage.objects where bucket_id = 'exportacoes' and name like p_org::text || '/%')),
    'retain', jsonb_build_object(
      'contratos_saas', (select count(*) from public.saas_contracts where organization_id = p_org),
      'pedidos_pagamentos', (select count(*) from public.saas_orders where organization_id = p_org),
      'motivo', 'contratos, aceites e pagamentos ficam guardados para cumprimento de obrigação legal e exercício regular de direitos; o vínculo com o escritório é desfeito'),
    'exports', (select coalesce(jsonb_agg(jsonb_build_object('at', requested_at, 'status', status, 'downloads', downloads) order by requested_at desc), '[]') from public.data_exports where organization_id = p_org),
    'backups', 'as cópias de segurança cifradas que contêm estes dados são substituídas em ciclo de 30 cópias diárias; até lá, permanecem cifradas e só são usadas para recuperação de desastre');
end $$;

create or replace function public.platform_erasure_candidates() returns table (id uuid, slug text, name text, closed_at timestamptz, eligible_at timestamptz, eligible boolean, status_reason text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform(array['superadmin','platform_admin','platform_auditor']) then raise exception 'somente a plataforma' using errcode = '42501'; end if;
  return query select o.id, o.slug, o.name, o.closed_at, o.closed_at + interval '90 days', o.closed_at + interval '90 days' <= now(), o.status_reason
    from public.organizations o where o.status = 'cancelada' and o.closed_at is not null order by o.closed_at;
end $$;

-- 8) Etapa de banco da eliminação: só o servidor (service_role), depois de conferir senha, motivo e confirmação
--    e de remover os arquivos. Uma transação. Contratos/pedidos são preservados (FK on delete set null).
create or replace function public.saas_erase_org_db(p_erasure uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e public.data_erasures; o public.organizations; counts jsonb;
begin
  select * into e from public.data_erasures where id = p_erasure for update;
  if e.id is null or e.status <> 'arquivos_removidos' then raise exception 'pedido de eliminação inválido' using errcode = '22023'; end if;
  select * into o from public.organizations where id = e.organization_id for update;
  if o.id is null then raise exception 'escritório já não existe' using errcode = 'P0002'; end if;
  if o.status <> 'cancelada' or o.closed_at is null or o.closed_at + interval '90 days' > now() then raise exception 'escritório não elegível (exige cancelado há 90 dias)' using errcode = '22023'; end if;
  if exists (select 1 from storage.objects where (bucket_id = 'documentos' and name like o.id::text || '/%') or (bucket_id = 'exportacoes' and name like o.id::text || '/%')) then
    raise exception 'ainda há arquivos do escritório no armazenamento' using errcode = '22023';
  end if;
  counts := jsonb_build_object(
    'registros_operacionais', (select count(*) from public.org_records where organization_id = o.id),
    'clientes', (select count(*) from public.clients where organization_id = o.id),
    'casos', (select count(*) from public.cases where organization_id = o.id),
    'documentos', (select count(*) from public.documents where organization_id = o.id),
    'trilha_auditoria_escritorio', (select count(*) from public.audit_logs where organization_id = o.id));
  delete from public.audit_logs where organization_id = o.id;
  delete from public.organizations where id = o.id; -- cascata: registros, equipe, portal, WhatsApp, IA, exportações, perfil
  delete from public.audit_logs where organization_id = o.id; -- linhas geradas pelos gatilhos de auditoria durante a cascata
  update public.data_erasures set status = 'concluida', db_removed = counts, finished_at = now(),
    retained = jsonb_build_object('contratos_saas', (select count(*) from public.saas_contracts where organization_id is null and party->>'slug' = o.slug), 'motivo', 'obrigação legal e exercício regular de direitos'),
    pending = jsonb_build_object('backups', 'cópias cifradas expiram no ciclo de 30 cópias diárias', 'contas_de_usuario', 'contas de login sem outro vínculo ficam bloqueadas sem escritório; podem ser removidas no Auth')
    where id = e.id;
  insert into public.audit_logs (organization_id, actor_id, action, entity, entity_id, detail)
    values (null, e.requested_by, 'eliminacao.concluida', 'data_erasures', e.id::text, 'escritório ' || o.slug || ' eliminado após 90 dias do encerramento; contratos e pagamentos preservados');
  return counts;
end $$;
revoke execute on function public.saas_erase_org_db(uuid) from public, anon, authenticated;
grant execute on function public.saas_erase_org_db(uuid) to service_role;

revoke execute on function public.platform_erasure_preview(uuid), public.platform_erasure_candidates(), public.next_business_day(timestamptz) from public, anon;
grant execute on function public.platform_erasure_preview(uuid), public.platform_erasure_candidates(), public.next_business_day(timestamptz) to authenticated;
