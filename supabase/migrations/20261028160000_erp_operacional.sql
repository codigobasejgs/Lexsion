-- LexSion — Onda 2: campos que as telas do ERP já usam + integridade entre escritórios + portal real + plataforma.
-- Só ADITIVA: nenhuma coluna removida, nenhum dado alterado.

-- ============ Campos operacionais ============
alter table public.clients
  add column if not exists social_name text,
  add column if not exists city text not null default '',
  add column if not exists uf text not null default '',
  add column if not exists profession text,
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists origin text not null default 'Cadastro manual',
  add column if not exists status text not null default 'ativo' check (status in ('ativo','arquivado'));

alter table public.cases
  add column if not exists service text not null default '',
  add column if not exists kind text not null default 'administrativo' check (kind in ('consultivo','administrativo','judicial')),
  add column if not exists priority text not null default 'normal' check (priority in ('baixa','normal','alta')),
  add column if not exists portal_status text not null default 'Recebemos seu caso e estamos fazendo a primeira análise.',
  add column if not exists portal_next_step text not null default 'Aguarde o contato da equipe.';

alter table public.tasks
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists priority text not null default 'normal' check (priority in ('baixa','normal','alta')),
  add column if not exists in_progress boolean not null default false,
  add column if not exists checklist jsonb not null default '[]'::jsonb,
  add column if not exists comments jsonb not null default '[]'::jsonb,
  add column if not exists recurrence jsonb,
  add column if not exists series_id uuid,
  add column if not exists anchor_day int;
-- Recorrência: concluir de novo não duplica a próxima ocorrência.
create unique index if not exists tasks_series_due_uq on public.tasks (series_id, due) where series_id is not null;

alter table public.documents
  add column if not exists request_note text,
  add column if not exists reject_reason text,
  add column if not exists origin text not null default 'equipe' check (origin in ('equipe','portal','whatsapp')),
  add column if not exists requested_at timestamptz,
  add column if not exists received_at timestamptz,
  add column if not exists tags text[] not null default '{}',
  add column if not exists history jsonb not null default '[]'::jsonb,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- ============ Integridade: referências só dentro do mesmo escritório ============
create or replace function public.check_same_org_refs() returns trigger language plpgsql as $$
declare j jsonb := to_jsonb(new);
begin
  if j ? 'client_id' and j->>'client_id' is not null and not exists (select 1 from public.clients c where c.id = (j->>'client_id')::uuid and c.organization_id = new.organization_id) then
    raise exception 'cliente de outro escritório' using errcode = '23514';
  end if;
  if j ? 'case_id' and j->>'case_id' is not null and not exists (select 1 from public.cases k where k.id = (j->>'case_id')::uuid and k.organization_id = new.organization_id) then
    raise exception 'caso de outro escritório' using errcode = '23514';
  end if;
  if j ? 'depends_on' and j->>'depends_on' is not null and not exists (select 1 from public.tasks t where t.id = (j->>'depends_on')::uuid and t.organization_id = new.organization_id) then
    raise exception 'tarefa de outro escritório' using errcode = '23514';
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['tasks','documents','drafts','portal_updates'] loop
    execute format('drop trigger if exists %I_same_org on public.%I', t, t);
    execute format('create trigger %I_same_org before insert or update on public.%I for each row execute function public.check_same_org_refs()', t, t);
  end loop;
end $$;

-- ============ Portal do cliente ============
-- Cliente lê o próprio escritório (nome e marca no portal).
drop policy if exists org_portal_read on public.organizations;
create policy org_portal_read on public.organizations for select to authenticated
  using (public.org_active(id) and exists (select 1 from public.client_portal_access p where p.user_id = auth.uid() and p.organization_id = organizations.id));
-- Cliente vê os pedidos de documento feitos a ele (para poder enviar). requested_at marca o PEDIDO: documento interno nunca aparece.
drop policy if exists docs_client_requested on public.documents;
create policy docs_client_requested on public.documents for select to authenticated
  using (status = 'solicitado' and requested_at is not null and public.org_active(organization_id) and exists (select 1 from public.client_portal_access p where p.user_id = auth.uid() and p.client_id = documents.client_id));
-- Cliente grava arquivo SÓ na pasta de um pedido aberto dele: <org>/<documento>/<arquivo>.
drop policy if exists docs_storage_client_upload on storage.objects;
create policy docs_storage_client_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and exists (
    select 1 from public.documents d join public.client_portal_access p on p.client_id = d.client_id
    where p.user_id = auth.uid() and d.status = 'solicitado' and d.requested_at is not null and public.org_active(d.organization_id)
      and (storage.foldername(storage.objects.name))[1] = d.organization_id::text and (storage.foldername(storage.objects.name))[2] = d.id::text));

-- Conclui o envio do cliente: confere vínculo, pedido aberto e caminho; marca como recebido.
create or replace function public.portal_submit_document(p_doc uuid, p_path text, p_mime text, p_size bigint) returns public.documents
language plpgsql security definer set search_path = public as $$
declare d public.documents;
begin
  select * into d from public.documents where id = p_doc for update;
  if d.id is null or not public.org_active(d.organization_id) or not exists (select 1 from public.client_portal_access p where p.user_id = auth.uid() and p.client_id = d.client_id) then
    raise exception 'pedido não encontrado' using errcode = 'P0002';
  end if;
  if d.status <> 'solicitado' or d.requested_at is null then raise exception 'este pedido já foi atendido' using errcode = '23514'; end if;
  if p_path not like d.organization_id::text || '/' || d.id::text || '/%' then raise exception 'caminho inválido' using errcode = '22023'; end if;
  update public.documents set status = 'recebido', storage_path = p_path, mime = p_mime, size_bytes = p_size, received_at = now(), origin = 'portal',
    history = history || jsonb_build_array(jsonb_build_object('at', now(), 'actorId', auth.uid(), 'text', 'Enviado pelo cliente no portal'))
  where id = p_doc returning * into d;
  return d;
end $$;

-- Publicar no portal também atualiza o texto leigo do caso (mesma transação).
create or replace function public.publish_portal_update(p_update uuid) returns public.portal_updates
language plpgsql security definer set search_path = public as $$
declare u public.portal_updates;
begin
  select * into u from public.portal_updates where id = p_update for update;
  if u.id is null or not public.is_member(u.organization_id) then raise exception 'atualização não encontrada' using errcode = 'P0002'; end if;
  if not public.has_role(u.organization_id, array['admin','advogado']) then raise exception 'somente advogado(a) ou titular publica no portal' using errcode = '42501'; end if;
  if u.status = 'publicada' then return u; end if; -- idempotente
  update public.portal_updates set status = 'publicada', published_by = auth.uid(), published_at = now() where id = p_update returning * into u;
  update public.cases set portal_status = u.text, portal_next_step = u.next_step where id = u.case_id;
  return u;
end $$;

-- ============ Plataforma ============
create or replace function public.set_organization_plan(p_org uuid, p_plan text) returns public.organizations
language plpgsql security definer set search_path = public as $$
declare o public.organizations;
begin
  if not public.is_platform(array['superadmin','platform_admin']) then raise exception 'somente a plataforma altera o plano' using errcode = '42501'; end if;
  if p_plan not in ('trial','essencial','profissional','avancado','enterprise') then raise exception 'plano inválido' using errcode = '22023'; end if;
  update public.organizations set plan = p_plan, updated_at = now() where id = p_org returning * into o;
  if o.id is null then raise exception 'escritório não encontrado' using errcode = 'P0002'; end if;
  insert into public.audit_logs (organization_id, actor_id, action, entity, entity_id, detail) values (p_org, auth.uid(), 'plan', 'organizations', p_org::text, p_plan);
  return o;
end $$;

-- Consumo agregado por escritório (contagens, sem conteúdo): só a plataforma.
create or replace function public.platform_org_usage() returns table (organization_id uuid, members int, clients int, storage_bytes bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform() then raise exception 'somente a plataforma' using errcode = '42501'; end if;
  return query select o.id,
    (select count(*)::int from public.organization_memberships m where m.organization_id = o.id),
    (select count(*)::int from public.clients c where c.organization_id = o.id),
    (select coalesce(sum(d.size_bytes), 0)::bigint from public.documents d where d.organization_id = o.id)
  from public.organizations o;
end $$;

revoke execute on function public.portal_submit_document(uuid, text, text, bigint), public.set_organization_plan(uuid, text), public.platform_org_usage(), public.check_same_org_refs() from public, anon;
grant execute on function public.portal_submit_document(uuid, text, text, bigint), public.set_organization_plan(uuid, text), public.platform_org_usage() to authenticated;
