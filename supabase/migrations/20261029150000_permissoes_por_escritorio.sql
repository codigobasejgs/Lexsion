-- Permissões GRANULARES por escritório: o titular ajusta, por papel e por módulo (coleção), ler/gravar.
-- Regra de segurança: a personalização só RESTRINGE (deny) o que o papel já pode pelo catálogo da plataforma
-- (collection_policies) — nunca concede além do teto. Assim não há escalada de privilégio por configuração.
-- Também: revogação de acesso a UMA pessoa específica num módulo (member deny), com motivo e autor auditados.
-- Aplicado no banco (record_readable/record_writable), não só no menu. Aditivo; nada existente é alterado.

create table if not exists public.org_role_restrictions (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('tenant_admin','advogado','controladoria','financeiro','atendimento','estagiario','external_collaborator')),
  collection text not null references public.collection_policies(collection),
  deny_read boolean not null default false,
  deny_write boolean not null default false,
  reason text check (length(reason) <= 300),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, role, collection)
);
create table if not exists public.org_member_restrictions (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  collection text not null references public.collection_policies(collection),
  deny_read boolean not null default false,
  deny_write boolean not null default true,
  reason text not null check (length(reason) between 3 and 300),
  expires_at timestamptz,                       -- restrição temporária (ex.: afastamento); null = até revogar
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id, collection)
);
alter table public.org_role_restrictions enable row level security;
alter table public.org_member_restrictions enable row level security;
-- Leitura: membros veem as regras do próprio escritório (transparência de "o que meu papel pode"). Escrita: titular/gestor.
create policy orr_read on public.org_role_restrictions for select using (public.is_member(organization_id));
create policy orr_write on public.org_role_restrictions for all using (public.has_role(organization_id, array['admin','tenant_admin'])) with check (public.has_role(organization_id, array['admin','tenant_admin']));
create policy omr_read on public.org_member_restrictions for select using (public.has_role(organization_id, array['admin','tenant_admin']) or user_id = auth.uid());
create policy omr_write on public.org_member_restrictions for all using (public.has_role(organization_id, array['admin','tenant_admin'])) with check (public.has_role(organization_id, array['admin','tenant_admin']));
revoke all on public.org_role_restrictions, public.org_member_restrictions from anon;
grant select, insert, update, delete on public.org_role_restrictions, public.org_member_restrictions to authenticated; -- RLS decide
revoke truncate, references, trigger on public.org_role_restrictions, public.org_member_restrictions from authenticated;

-- Gestor não restringe o titular nem a si próprio (evita travar quem administra); autoria sempre do usuário real.
create or replace function public.restrictions_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare me text := public.my_role(new.organization_id); target text;
begin
  if auth.uid() is null then return new; end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  if tg_table_name = 'org_role_restrictions' and to_jsonb(new)->>'role' = 'tenant_admin' and me <> 'admin' then
    raise exception 'somente o titular restringe o papel de gestor' using errcode = '42501';
  end if;
  if tg_table_name = 'org_member_restrictions' then
    if (to_jsonb(new)->>'user_id')::uuid = auth.uid() then raise exception 'ninguém restringe o próprio acesso' using errcode = '42501'; end if;
    select role into target from public.organization_memberships where organization_id = new.organization_id and user_id = (to_jsonb(new)->>'user_id')::uuid;
    if target is null then raise exception 'pessoa não pertence a este escritório' using errcode = '23514'; end if;
    if target = 'admin' then raise exception 'o acesso do titular não é restringido' using errcode = '42501'; end if;
    if target = 'tenant_admin' and me <> 'admin' then raise exception 'somente o titular restringe um gestor' using errcode = '42501'; end if;
  end if;
  return new;
end $$;
revoke execute on function public.restrictions_guard() from public, anon, authenticated;
create trigger orr_guard before insert or update on public.org_role_restrictions for each row execute function public.restrictions_guard();
create trigger omr_guard before insert or update on public.org_member_restrictions for each row execute function public.restrictions_guard();
-- Auditoria com antes/depois (quem mudou qual permissão de quem, e o motivo).
create or replace function public.restrictions_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record := coalesce(new, old);
begin
  insert into public.audit_logs (organization_id, actor_id, action, entity, entity_id, detail)
  values (r.organization_id, auth.uid(), 'permissao.' || lower(tg_op), tg_table_name,
          case when tg_table_name = 'org_role_restrictions' then (to_jsonb(r)->>'role') || ':' || r.collection else (to_jsonb(r)->>'user_id') || ':' || r.collection end,
          left(jsonb_build_object('antes', case when tg_op <> 'INSERT' then to_jsonb(old) - 'updated_at' end, 'depois', case when tg_op <> 'DELETE' then to_jsonb(new) - 'updated_at' end)::text, 1000));
  return r;
end $$;
revoke execute on function public.restrictions_audit() from public, anon, authenticated;
create trigger orr_audit after insert or update or delete on public.org_role_restrictions for each row execute function public.restrictions_audit();
create trigger omr_audit after insert or update or delete on public.org_member_restrictions for each row execute function public.restrictions_audit();

-- Decisão efetiva: teto da plataforma E nenhuma restrição do papel E nenhuma restrição vigente da pessoa.
create or replace function public.restricted(org uuid, coll text, kind text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.org_role_restrictions r where r.organization_id = org and r.collection = coll and r.role = public.my_role(org)
                   and case when kind = 'read' then r.deny_read else r.deny_write end)
      or exists (select 1 from public.org_member_restrictions m where m.organization_id = org and m.collection = coll and m.user_id = auth.uid()
                   and (m.expires_at is null or m.expires_at > now()) and case when kind = 'read' then m.deny_read else m.deny_write end)
$$;
revoke execute on function public.restricted(uuid, text, text) from public, anon;

create or replace function public.record_readable(org uuid, coll text, d jsonb) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare r text := public.my_role(org);
begin
  if r is null or not exists (select 1 from public.collection_policies p where p.collection = coll and r = any(p.read_roles)) then return false; end if;
  if r <> 'admin' and public.restricted(org, coll, 'read') then return false; end if; -- personalização do escritório
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
     and (public.my_role(org) = 'admin' or not public.restricted(org, coll, 'write'))
$$;

-- "O que esta pessoa pode fazer" (diagnóstico sem dados): para o titular/gestor e para a própria pessoa.
create or replace function public.effective_access(p_org uuid, p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r text;
begin
  if not (public.has_role(p_org, array['admin','tenant_admin']) or p_user = auth.uid()) then raise exception 'sem permissão' using errcode = '42501'; end if;
  select role into r from public.organization_memberships where organization_id = p_org and user_id = p_user;
  if r is null then return null; end if;
  return jsonb_build_object('role', r, 'collections', (select jsonb_agg(jsonb_build_object(
    'collection', p.collection,
    'read', r = any(p.read_roles) and (r = 'admin' or not exists (select 1 from public.org_role_restrictions x where x.organization_id = p_org and x.role = r and x.collection = p.collection and x.deny_read)
                                         and not exists (select 1 from public.org_member_restrictions m where m.organization_id = p_org and m.user_id = p_user and m.collection = p.collection and m.deny_read and (m.expires_at is null or m.expires_at > now()))),
    'write', r = any(p.write_roles) and (r = 'admin' or not exists (select 1 from public.org_role_restrictions x where x.organization_id = p_org and x.role = r and x.collection = p.collection and x.deny_write)
                                         and not exists (select 1 from public.org_member_restrictions m where m.organization_id = p_org and m.user_id = p_user and m.collection = p.collection and m.deny_write and (m.expires_at is null or m.expires_at > now()))),
    'ceiling_read', r = any(p.read_roles), 'ceiling_write', r = any(p.write_roles)) order by p.collection) from public.collection_policies p));
end $$;
revoke execute on function public.effective_access(uuid, uuid) from public, anon;
grant execute on function public.effective_access(uuid, uuid) to authenticated;
