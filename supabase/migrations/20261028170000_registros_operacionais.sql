-- LexSion — Onda 3: armazenamento operacional dos módulos do ERP (CRM, agenda, prazos, financeiro, minutas, …).
-- Um registro = um objeto do domínio (src/domain/types.ts) em jsonb, isolado por escritório e por papel (RLS).
-- Coleção sem regra em collection_policies = acesso negado. Somente ADITIVA.

create table if not exists public.collection_policies (
  collection text primary key,
  read_roles text[] not null,
  write_roles text[] not null
);
alter table public.collection_policies enable row level security;
drop policy if exists cp_read on public.collection_policies;
create policy cp_read on public.collection_policies for select to authenticated using (true);

insert into public.collection_policies (collection, read_roles, write_roles) values
  -- equipe interna (sem correspondente externo)
  ('clients',          '{admin,tenant_admin,advogado,controladoria,financeiro,atendimento,estagiario}', '{admin,tenant_admin,advogado,controladoria,atendimento,estagiario}'),
  ('notifications',    '{admin,tenant_admin,advogado,controladoria,financeiro,atendimento,estagiario,external_collaborator}', '{admin,tenant_admin,advogado,controladoria,financeiro,atendimento,estagiario,external_collaborator}'),
  ('settings',         '{admin,tenant_admin,advogado,controladoria,financeiro,atendimento,estagiario,external_collaborator}', '{admin,tenant_admin}'),
  ('integrations',     '{admin,tenant_admin,advogado,controladoria,financeiro,atendimento,estagiario}', '{admin}'),
  ('integrationEvents','{admin,tenant_admin}', '{admin,tenant_admin,advogado,atendimento}'),
  ('importBatches',    '{admin,tenant_admin}', '{admin,tenant_admin}'),
  -- jurídico (correspondente vê só o que lhe foi atribuído: ver record_readable)
  ('cases',            '{admin,tenant_admin,advogado,controladoria,financeiro,atendimento,estagiario,external_collaborator}', '{admin,tenant_admin,advogado,controladoria,atendimento,estagiario}'),
  ('tasks',            '{admin,tenant_admin,advogado,controladoria,financeiro,atendimento,estagiario,external_collaborator}', '{admin,tenant_admin,advogado,controladoria,financeiro,atendimento,estagiario,external_collaborator}'),
  ('events',           '{admin,tenant_admin,advogado,controladoria,financeiro,atendimento,estagiario,external_collaborator}', '{admin,tenant_admin,advogado,controladoria,atendimento,estagiario,external_collaborator}'),
  ('documents',        '{admin,tenant_admin,advogado,controladoria,atendimento,estagiario,external_collaborator}', '{admin,tenant_admin,advogado,controladoria,atendimento,estagiario,external_collaborator}'),
  ('files',            '{admin,tenant_admin,advogado,controladoria,atendimento,estagiario,external_collaborator}', '{admin,tenant_admin,advogado,controladoria,atendimento,estagiario,external_collaborator}'),
  ('deadlines',        '{admin,tenant_admin,advogado,controladoria,estagiario}', '{admin,tenant_admin,advogado,controladoria,estagiario}'),
  ('publications',     '{admin,tenant_admin,advogado,controladoria,estagiario}', '{admin,tenant_admin,advogado,controladoria,estagiario}'),
  ('processes',        '{admin,tenant_admin,advogado,controladoria,estagiario}', '{admin,tenant_admin,advogado,controladoria,estagiario}'),
  ('caseEvents',       '{admin,tenant_admin,advogado,controladoria,estagiario}', '{admin,tenant_admin,advogado,controladoria,estagiario}'),
  ('requisitions',     '{admin,tenant_admin,advogado,controladoria,financeiro}', '{admin,tenant_admin,advogado,controladoria}'),
  ('drafts',           '{admin,tenant_admin,advogado,controladoria,estagiario}', '{admin,tenant_admin,advogado,controladoria,estagiario}'),
  ('templates',        '{admin,tenant_admin,advogado,controladoria,estagiario}', '{admin,tenant_admin,advogado}'),
  ('legalSources',     '{admin,tenant_admin,advogado,controladoria,estagiario}', '{admin,tenant_admin,advogado,estagiario}'),
  ('pensionAnalyses',  '{admin,tenant_admin,advogado,estagiario}', '{admin,tenant_admin,advogado,estagiario}'),
  ('calculations',     '{admin,tenant_admin,advogado,estagiario}', '{admin,tenant_admin,advogado,estagiario}'),
  ('assessments',      '{admin,tenant_admin,advogado,estagiario}', '{admin,tenant_admin,advogado,estagiario}'),
  -- comercial e atendimento
  ('leads',            '{admin,tenant_admin,advogado,atendimento}', '{admin,tenant_admin,advogado,atendimento}'),
  ('conversations',    '{admin,tenant_admin,advogado,atendimento}', '{admin,tenant_admin,advogado,atendimento}'),
  ('messages',         '{admin,tenant_admin,advogado,atendimento}', '{admin,tenant_admin,advogado,atendimento}'),
  ('outbox',           '{admin,tenant_admin,advogado,atendimento}', '{admin,tenant_admin,advogado,atendimento}'),
  ('objections',       '{admin,tenant_admin,advogado,atendimento}', '{admin,tenant_admin,advogado,atendimento}'),
  ('campaigns',        '{admin,tenant_admin,advogado,atendimento}', '{admin,tenant_admin,atendimento}'),
  ('landingPages',     '{admin,tenant_admin,advogado,atendimento}', '{admin,tenant_admin,atendimento}'),
  ('contents',         '{admin,tenant_admin,advogado,atendimento}', '{admin,tenant_admin,atendimento}'),
  ('agents',           '{admin,tenant_admin,advogado,atendimento}', '{admin,tenant_admin}'),
  ('agentRuns',        '{admin,tenant_admin,advogado,atendimento}', '{admin,tenant_admin,advogado,atendimento}'),
  ('automations',      '{admin,tenant_admin,advogado,atendimento}', '{admin,tenant_admin}'),
  ('automationRuns',   '{admin,tenant_admin,advogado,atendimento}', '{admin,tenant_admin,advogado,atendimento}'),
  -- financeiro do escritório (honorários). Faturamento SaaS da plataforma fica em platform_records.
  ('proposals',        '{admin,tenant_admin,advogado,financeiro}', '{admin,tenant_admin,advogado,financeiro}'),
  ('contracts',        '{admin,tenant_admin,advogado,financeiro}', '{admin,tenant_admin,advogado,financeiro}'),
  ('installments',     '{admin,tenant_admin,advogado,financeiro}', '{admin,tenant_admin,advogado,financeiro}'),
  ('payments',         '{admin,tenant_admin,advogado,financeiro}', '{admin,tenant_admin,financeiro}'),
  ('charges',          '{admin,tenant_admin,advogado,financeiro}', '{admin,tenant_admin,financeiro}'),
  ('expenses',         '{admin,tenant_admin,financeiro}', '{admin,tenant_admin,financeiro}'),
  ('bankLines',        '{admin,tenant_admin,financeiro}', '{admin,tenant_admin,financeiro}'),
  ('receipts',         '{admin,tenant_admin,advogado,financeiro}', '{admin,tenant_admin,financeiro}')
on conflict (collection) do update set read_roles = excluded.read_roles, write_roles = excluded.write_roles;

create table if not exists public.org_records (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  collection text not null references public.collection_policies(collection),
  id text not null check (length(id) between 1 and 200),
  data jsonb not null,
  version int not null default 1,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, collection, id),
  -- o objeto não pode dizer outro escritório/id diferente das colunas (impede "mudar de escritório" pelo jsonb)
  check (data->>'organizationId' = organization_id::text and data->>'id' = id)
);
create index if not exists org_records_coll_idx on public.org_records (collection, organization_id);
create index if not exists org_records_client_idx on public.org_records (organization_id, (data->>'clientId'));

-- ============ Regras de leitura e escrita ============
create or replace function public.my_role(org uuid) returns text
language sql stable security definer set search_path = public as $$
  select m.role from public.organization_memberships m where m.organization_id = org and m.user_id = auth.uid() and public.org_active(org)
$$;

create or replace function public.record_readable(org uuid, coll text, d jsonb) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare r text := public.my_role(org);
begin
  if r is null or not exists (select 1 from public.collection_policies p where p.collection = coll and r = any(p.read_roles)) then return false; end if;
  -- Caso sigiloso: só titular, advogado(a) ou responsável.
  if coll = 'cases' and coalesce((d->>'confidential')::boolean, false) and r not in ('admin','advogado') and d->>'ownerId' is distinct from auth.uid()::text then return false; end if;
  -- Correspondente externo: só o que lhe foi atribuído (e documentos desses casos).
  if r = 'external_collaborator' then
    if coll in ('cases','events') then return d->>'ownerId' = auth.uid()::text; end if;
    if coll = 'tasks' then return d->>'assigneeId' = auth.uid()::text; end if;
    if coll = 'documents' then return exists (select 1 from public.org_records k where k.organization_id = org and k.collection = 'cases' and k.id = d->>'caseId' and k.data->>'ownerId' = auth.uid()::text); end if;
    if coll = 'files' then return false; end if;
  end if;
  return true;
end $$;

create or replace function public.record_writable(org uuid, coll text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.collection_policies p where p.collection = coll and public.my_role(org) = any(p.write_roles))
$$;

alter table public.org_records enable row level security;
drop policy if exists rec_read on public.org_records;
create policy rec_read on public.org_records for select to authenticated using (public.record_readable(organization_id, collection, data));
drop policy if exists rec_insert on public.org_records;
create policy rec_insert on public.org_records for insert to authenticated with check (public.record_writable(organization_id, collection));
drop policy if exists rec_update on public.org_records;
create policy rec_update on public.org_records for update to authenticated
  using (public.record_writable(organization_id, collection) and public.record_readable(organization_id, collection, data))
  with check (public.record_writable(organization_id, collection));
drop policy if exists rec_delete on public.org_records;
create policy rec_delete on public.org_records for delete to authenticated
  using (public.record_writable(organization_id, collection) and public.record_readable(organization_id, collection, data));

-- ============ Ações sensíveis verificadas no banco (não dependem da tela) ============
create or replace function public.org_records_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare
  r text := public.my_role(new.organization_id);
  approver boolean := r in ('admin','advogado');
  old_d jsonb := case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end;
begin
  if auth.uid() is null then return new; end if; -- operador do banco/serviço
  new.updated_by := auth.uid();
  new.updated_at := now();
  if tg_op = 'UPDATE' then new.version := old.version + 1; end if;
  if new.collection = 'drafts' and new.data->>'status' in ('aprovado','exportado') and coalesce(old_d->>'status','') not in ('aprovado','exportado') then
    if not approver then raise exception 'somente advogado(a) ou titular aprova a minuta' using errcode = '42501'; end if;
    if new.data->>'body' ~ '\[[\w.]+ — não preenchido\]' then raise exception 'há campos não preenchidos' using errcode = '23514'; end if;
  end if;
  if new.collection = 'proposals' and new.data->>'status' = 'aprovada' and coalesce(old_d->>'status','') <> 'aprovada' and not approver then
    raise exception 'somente advogado(a) ou titular aprova a proposta' using errcode = '42501';
  end if;
  -- Publicação no portal: texto leigo ou atualização publicada só por advogado(a)/titular.
  if new.collection = 'cases' and not approver and (
       new.data->'portalStatus' is distinct from old_d->'portalStatus' and tg_op = 'UPDATE'
    or exists (select 1 from jsonb_array_elements(coalesce(new.data->'portalUpdates','[]')) u where u ? 'publishedAt'
               and not exists (select 1 from jsonb_array_elements(coalesce(old_d->'portalUpdates','[]')) o where o->>'id' = u->>'id' and o ? 'publishedAt'))) then
    raise exception 'somente advogado(a) ou titular publica no portal' using errcode = '42501';
  end if;
  if new.collection = 'documents' and coalesce((new.data->>'sharedWithClient')::boolean, false) and new.data->>'type' in ('Laudo','Exame') then
    raise exception 'dados de saúde não são compartilhados pelo portal' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists org_records_guard on public.org_records;
create trigger org_records_guard before insert or update on public.org_records for each row execute function public.org_records_guard();

create or replace function public.org_records_audit() returns trigger language plpgsql security definer set search_path = public as $$
declare r public.org_records := coalesce(new, old);
begin
  insert into public.audit_logs (organization_id, actor_id, action, entity, entity_id) values (r.organization_id, auth.uid(), lower(tg_op), r.collection, r.id);
  return null;
end $$;
drop trigger if exists org_records_audit on public.org_records;
create trigger org_records_audit after insert or update or delete on public.org_records for each row execute function public.org_records_audit();

-- Gravação em lote numa transação (tudo ou nada) com controle de versão: quem leu versão antiga recebe conflito.
-- SECURITY INVOKER: a RLS do usuário vale para cada linha.
create or replace function public.apply_changes(p_changes jsonb) returns int
language plpgsql security invoker set search_path = public as $$
declare c jsonb; n int := 0; hit int;
begin
  for c in select * from jsonb_array_elements(p_changes) loop
    if c->>'op' = 'delete' then
      delete from public.org_records where organization_id = (c->>'org')::uuid and collection = c->>'collection' and id = c->>'id';
    elsif c->>'expected' is null then
      insert into public.org_records (organization_id, collection, id, data) values ((c->'data'->>'organizationId')::uuid, c->>'collection', c->'data'->>'id', c->'data');
    else
      update public.org_records set data = c->'data'
        where organization_id = (c->'data'->>'organizationId')::uuid and collection = c->>'collection' and id = c->'data'->>'id' and version = (c->>'expected')::int;
      get diagnostics hit = row_count;
      if hit = 0 then raise exception 'registro alterado por outra pessoa ou sem permissão (%/%)', c->>'collection', c->'data'->>'id' using errcode = '40001'; end if;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Nota de auditoria escrita pela tela (texto humano); a trilha técnica vem do trigger.
drop policy if exists audit_insert_member on public.audit_logs;
create policy audit_insert_member on public.audit_logs for insert to authenticated with check (actor_id = auth.uid() and public.is_member(organization_id));
grant insert on public.audit_logs to authenticated;

-- Equipe do escritório com nome e e-mail (para responsáveis, atribuições e convites).
create or replace function public.org_team(p_org uuid) returns table (user_id uuid, full_name text, email text, role text)
language sql stable security definer set search_path = public as $$
  select m.user_id, coalesce(nullif(p.full_name, ''), split_part(u.email, '@', 1)), u.email::text, m.role
  from public.organization_memberships m join auth.users u on u.id = m.user_id left join public.profiles p on p.user_id = m.user_id
  where m.organization_id = p_org and public.is_member(p_org)
$$;

-- ============ Portal do cliente (sobre os registros operacionais) ============
create table if not exists public.portal_links (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, organization_id, client_id)
);
alter table public.portal_links enable row level security;
drop policy if exists pl_read on public.portal_links;
create policy pl_read on public.portal_links for select to authenticated using (user_id = auth.uid() or public.has_role(organization_id, array['admin','tenant_admin','advogado']));
drop policy if exists pl_insert on public.portal_links;
create policy pl_insert on public.portal_links for insert to authenticated with check (public.has_role(organization_id, array['admin','tenant_admin','advogado'])
  and exists (select 1 from public.org_records r where r.organization_id = portal_links.organization_id and r.collection = 'clients' and r.id = portal_links.client_id));
drop policy if exists pl_delete on public.portal_links;
create policy pl_delete on public.portal_links for delete to authenticated using (public.has_role(organization_id, array['admin','tenant_admin','advogado']));
grant select, insert, delete on public.portal_links to authenticated;

-- Visão do cliente: só campos leigos e só o que foi liberado. Nada interno sai daqui.
create or replace function public.portal_snapshot() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l public.portal_links; o public.organizations;
begin
  select pl.* into l from public.portal_links pl join public.organizations x on x.id = pl.organization_id
    where pl.user_id = auth.uid() and public.org_active(pl.organization_id) order by pl.created_at limit 1;
  if l.user_id is null then return null; end if;
  select * into o from public.organizations where id = l.organization_id;
  return jsonb_build_object(
    'organization', jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug, 'status', o.status, 'branding', o.branding),
    'client', (select jsonb_build_object('id', r.id, 'name', r.data->>'name') from public.org_records r where r.organization_id = l.organization_id and r.collection = 'clients' and r.id = l.client_id),
    'cases', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'organizationId', o.id, 'clientId', l.client_id, 'title', r.data->'title', 'phase', r.data->'phase',
        'portalStatus', r.data->'portalStatus', 'portalNextStep', r.data->'portalNextStep',
        'portalUpdates', coalesce((select jsonb_agg(jsonb_build_object('id', u->'id', 'text', u->'text', 'nextStep', u->'nextStep', 'createdAt', u->'createdAt', 'publishedAt', u->'publishedAt'))
                                    from jsonb_array_elements(coalesce(r.data->'portalUpdates','[]')) u where u ? 'publishedAt'), '[]'::jsonb)))
      from public.org_records r where r.organization_id = l.organization_id and r.collection = 'cases' and r.data->>'clientId' = l.client_id), '[]'::jsonb),
    'documents', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'organizationId', o.id, 'clientId', l.client_id, 'caseId', r.data->'caseId', 'name', r.data->'name', 'type', r.data->'type',
        'status', r.data->'status', 'receivedAt', r.data->'receivedAt', 'requestNote', r.data->'requestNote', 'origin', r.data->'origin', 'sharedWithClient', r.data->'sharedWithClient'))
      from public.org_records r where r.organization_id = l.organization_id and r.collection = 'documents' and r.data->>'clientId' = l.client_id
        and (r.data->>'status' = 'solicitado' or coalesce((r.data->>'sharedWithClient')::boolean, false) or r.data->>'origin' = 'portal')), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'organizationId', o.id, 'clientId', l.client_id, 'caseId', r.data->'caseId', 'title', r.data->'title', 'type', r.data->'type',
        'start', r.data->'start', 'end', r.data->'end', 'location', r.data->'location', 'requiredDocs', r.data->'requiredDocs', 'visibleToClient', true))
      from public.org_records r where r.organization_id = l.organization_id and r.collection = 'events' and r.data->>'clientId' = l.client_id and coalesce((r.data->>'visibleToClient')::boolean, false)), '[]'::jsonb),
    'installments', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'organizationId', o.id, 'clientId', l.client_id, 'label', r.data->'label', 'amount', r.data->'amount', 'paid', r.data->'paid', 'due', r.data->'due', 'status', r.data->'status'))
      from public.org_records r where r.organization_id = l.organization_id and r.collection = 'installments' and r.data->>'clientId' = l.client_id and r.data->>'status' <> 'cancelada'), '[]'::jsonb),
    'charges', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'organizationId', o.id, 'installmentId', c.data->'installmentId', 'status', c.data->'status', 'method', c.data->'method', 'amount', c.data->'amount', 'due', c.data->'due', 'link', c.data->'link'))
      from public.org_records c where c.organization_id = l.organization_id and c.collection = 'charges'
        and exists (select 1 from public.org_records i where i.organization_id = l.organization_id and i.collection = 'installments' and i.id = c.data->>'installmentId' and i.data->>'clientId' = l.client_id)), '[]'::jsonb)
  );
end $$;

-- Cliente envia arquivo para um pedido aberto dele (arquivo já gravado no Storage em <org>/<documento>/…).
create or replace function public.portal_send_document(p_doc text, p_path text, p_name text, p_mime text, p_size bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare l public.portal_links; d public.org_records; fid text := 'file-' || substr(md5(random()::text), 1, 10); ts text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  select pl.* into l from public.portal_links pl where pl.user_id = auth.uid() and public.org_active(pl.organization_id)
    and exists (select 1 from public.org_records r where r.organization_id = pl.organization_id and r.collection = 'documents' and r.id = p_doc and r.data->>'clientId' = pl.client_id) limit 1;
  if l.user_id is null then raise exception 'pedido não encontrado' using errcode = 'P0002'; end if;
  select * into d from public.org_records where organization_id = l.organization_id and collection = 'documents' and id = p_doc for update;
  if d.data->>'status' <> 'solicitado' then raise exception 'este pedido já foi atendido' using errcode = '23514'; end if;
  if p_path not like l.organization_id::text || '/' || p_doc || '/%' then raise exception 'caminho inválido' using errcode = '22023'; end if;
  if p_mime not in ('application/pdf','image/jpeg','image/png','image/webp') or p_size not between 1 and 15728640 then raise exception 'arquivo não aceito' using errcode = '22023'; end if;
  insert into public.org_records (organization_id, collection, id, data) values (l.organization_id, 'files', fid,
    jsonb_build_object('id', fid, 'organizationId', l.organization_id, 'name', p_name, 'mime', p_mime, 'size', p_size, 'path', p_path, 'createdAt', ts));
  update public.org_records set version = version + 1, updated_at = now(), data = data || jsonb_build_object('status', 'recebido', 'receivedAt', ts, 'origin', 'portal',
      'versions', coalesce(data->'versions','[]'::jsonb) || jsonb_build_array(jsonb_build_object('id', 'v-' || fid, 'at', ts, 'actorId', auth.uid(), 'fileId', fid, 'size', p_size, 'mime', p_mime, 'note', 'Enviado pelo cliente no portal')),
      'history', coalesce(data->'history','[]'::jsonb) || jsonb_build_array(jsonb_build_object('at', ts, 'actorId', auth.uid(), 'text', 'Documento solicitado foi recebido pelo portal')))
    where organization_id = l.organization_id and collection = 'documents' and id = p_doc;
  return jsonb_build_object('documentId', p_doc, 'fileId', fid);
end $$;

-- Dúvida do cliente vira tarefa para o(a) responsável pelo caso.
create or replace function public.portal_ask(p_text text) returns text
language plpgsql security definer set search_path = public as $$
declare l public.portal_links; k public.org_records; tid text := 'task-' || substr(md5(random()::text), 1, 10);
begin
  if length(trim(coalesce(p_text, ''))) not between 5 and 2000 then raise exception 'escreva sua dúvida (5 a 2000 caracteres)' using errcode = '22023'; end if;
  select pl.* into l from public.portal_links pl where pl.user_id = auth.uid() and public.org_active(pl.organization_id) order by pl.created_at limit 1;
  if l.user_id is null then raise exception 'acesso ao portal não encontrado' using errcode = 'P0002'; end if;
  select * into k from public.org_records where organization_id = l.organization_id and collection = 'cases' and data->>'clientId' = l.client_id order by updated_at desc limit 1;
  insert into public.org_records (organization_id, collection, id, data) values (l.organization_id, 'tasks', tid, jsonb_build_object(
    'id', tid, 'organizationId', l.organization_id, 'title', 'Dúvida do cliente (portal): ' || left(trim(p_text), 80), 'clientId', l.client_id, 'caseId', k.id,
    'assigneeId', coalesce(k.data->>'ownerId', (select m.user_id::text from public.organization_memberships m where m.organization_id = l.organization_id and m.role = 'admin' limit 1)),
    'due', to_char((now() at time zone 'America/Sao_Paulo')::date + 1, 'YYYY-MM-DD'), 'priority', 'normal', 'done', false,
    'comments', jsonb_build_array(jsonb_build_object('at', now(), 'actorId', auth.uid(), 'text', trim(p_text)))));
  return tid;
end $$;

-- Storage: cliente grava só na pasta de um pedido aberto dele.
-- security definer: o cliente não lê org_records diretamente; a função confere só o vínculo e o pedido.
create or replace function public.portal_can_upload(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.portal_links pl join public.org_records d on d.organization_id = pl.organization_id and d.collection = 'documents' and d.data->>'clientId' = pl.client_id
    where pl.user_id = auth.uid() and public.org_active(pl.organization_id) and d.data->>'status' = 'solicitado'
      and (storage.foldername(p_name))[1] = pl.organization_id::text and (storage.foldername(p_name))[2] = d.id)
$$;
-- Cliente baixa só arquivo de documento compartilhado com ele (laudo/exame nunca, ver guard).
create or replace function public.portal_can_read(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.portal_links pl join public.org_records d on d.organization_id = pl.organization_id and d.collection = 'documents' and d.data->>'clientId' = pl.client_id
    where pl.user_id = auth.uid() and public.org_active(pl.organization_id) and coalesce((d.data->>'sharedWithClient')::boolean, false)
      and (storage.foldername(p_name))[1] = pl.organization_id::text and (storage.foldername(p_name))[2] = d.id)
$$;
revoke execute on function public.portal_can_upload(text), public.portal_can_read(text) from public, anon;
grant execute on function public.portal_can_upload(text), public.portal_can_read(text) to authenticated;
drop policy if exists docs_storage_portal_read on storage.objects;
create policy docs_storage_portal_read on storage.objects for select to authenticated using (bucket_id = 'documentos' and public.portal_can_read(name));
drop policy if exists docs_storage_portal_upload on storage.objects;
create policy docs_storage_portal_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and public.portal_can_upload(name));

-- ============ Plataforma (Super Admin) ============
alter table public.organizations add column if not exists meta jsonb not null default '{}'::jsonb;

create or replace function public.platform_set_org_meta(p_org uuid, p_meta jsonb) returns public.organizations
language plpgsql security definer set search_path = public as $$
declare o public.organizations;
begin
  if not public.is_platform(array['superadmin','platform_admin']) then raise exception 'somente a plataforma' using errcode = '42501'; end if;
  update public.organizations set meta = meta || coalesce(p_meta, '{}'::jsonb), updated_at = now() where id = p_org returning * into o;
  if o.id is null then raise exception 'escritório não encontrado' using errcode = 'P0002'; end if;
  insert into public.audit_logs (organization_id, actor_id, action, entity, entity_id, detail) values (p_org, auth.uid(), 'meta', 'organizations', p_org::text, left(p_meta::text, 500));
  return o;
end $$;

-- Marca inicial definida pela plataforma na criação (depois o titular edita pela própria tela).
create or replace function public.platform_set_org_branding(p_org uuid, p_branding jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform(array['superadmin','platform_admin']) then raise exception 'somente a plataforma' using errcode = '42501'; end if;
  update public.organizations set branding = coalesce(p_branding, '{}'::jsonb), updated_at = now() where id = p_org;
end $$;

create table if not exists public.platform_records (
  collection text not null check (collection in ('supportTickets','saasInvoices','plans')),
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
alter table public.platform_records enable row level security;
drop policy if exists plr_all on public.platform_records;
create policy plr_all on public.platform_records for all to authenticated using (public.is_platform()) with check (public.is_platform(array['superadmin','platform_admin']));
grant select, insert, update, delete on public.platform_records to authenticated;

-- Auditoria da plataforma visível ao Super Admin (inclui eventos sem escritório).
drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select to authenticated using (public.has_role(organization_id, array['admin']) or public.is_platform(array['superadmin','platform_admin']));

-- ============ Privilégios ============
grant select, insert, update, delete on public.org_records to authenticated;
grant select on public.collection_policies to authenticated;
revoke execute on function public.my_role(uuid), public.record_readable(uuid, text, jsonb), public.record_writable(uuid, text), public.apply_changes(jsonb), public.org_team(uuid),
  public.portal_snapshot(), public.portal_send_document(text, text, text, text, bigint), public.portal_ask(text), public.platform_set_org_meta(uuid, jsonb), public.platform_set_org_branding(uuid, jsonb),
  public.org_records_guard(), public.org_records_audit() from public, anon;
grant execute on function public.my_role(uuid), public.record_readable(uuid, text, jsonb), public.record_writable(uuid, text), public.apply_changes(jsonb), public.org_team(uuid),
  public.portal_snapshot(), public.portal_send_document(text, text, text, text, bigint), public.portal_ask(text), public.platform_set_org_meta(uuid, jsonb), public.platform_set_org_branding(uuid, jsonb) to authenticated;
