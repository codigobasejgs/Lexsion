-- 1) Titular do escritório NÃO pode mudar o próprio status/plano (antes a policy de update permitia qualquer coluna).
--    Só nome e marca; status e plano mudam pela função da plataforma, com motivo e auditoria.
revoke update on public.organizations from authenticated;
grant update (name, branding, updated_at) on public.organizations to authenticated;

-- 2) Escritório suspenso, inadimplente ou cancelado perde acesso aos dados (equipe e portal). Dados ficam preservados.
create or replace function public.org_active(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organizations o where o.id = org and o.status in ('ativa','trial'))
$$;

create or replace function public.is_member(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.org_active(org) and exists (select 1 from public.organization_memberships m where m.organization_id = org and m.user_id = auth.uid())
$$;

create or replace function public.has_role(org uuid, roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select public.org_active(org) and exists (select 1 from public.organization_memberships m where m.organization_id = org and m.user_id = auth.uid() and m.role = any(roles))
$$;

-- Portal: o acesso do cliente também cai quando o escritório não está ativo.
drop policy if exists clients_portal on public.clients;
create policy clients_portal on public.clients for select to authenticated using (public.org_active(organization_id) and exists (select 1 from public.client_portal_access p where p.user_id = auth.uid() and p.client_id = clients.id));
drop policy if exists cases_portal on public.cases;
create policy cases_portal on public.cases for select to authenticated using (public.org_active(organization_id) and exists (select 1 from public.client_portal_access p where p.user_id = auth.uid() and p.client_id = cases.client_id));
drop policy if exists pu_client on public.portal_updates;
create policy pu_client on public.portal_updates for select to authenticated using (status = 'publicada' and public.org_active(organization_id) and exists (select 1 from public.cases c join public.client_portal_access p on p.client_id = c.client_id where c.id = portal_updates.case_id and p.user_id = auth.uid()));
drop policy if exists docs_client on public.documents;
create policy docs_client on public.documents for select to authenticated using (shared_with_client and public.org_active(organization_id) and exists (select 1 from public.client_portal_access p where p.user_id = auth.uid() and p.client_id = documents.client_id));

-- 3) Mudança de status pela plataforma, com motivo obrigatório e auditoria.
alter table public.organizations add column if not exists status_reason text;
create or replace function public.set_organization_status(p_org uuid, p_status text, p_reason text) returns public.organizations
language plpgsql security definer set search_path = public as $$
declare o public.organizations;
begin
  if not public.is_platform(array['superadmin','platform_admin']) then raise exception 'somente a plataforma altera a situação do escritório' using errcode = '42501'; end if;
  if p_status not in ('ativa','trial','suspensa','inadimplente','cancelada') then raise exception 'situação inválida' using errcode = '22023'; end if;
  if p_status in ('suspensa','cancelada','inadimplente') and coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'informe o motivo (mínimo 5 caracteres)' using errcode = '23514'; end if;
  update public.organizations set status = p_status, status_reason = nullif(trim(p_reason), ''), updated_at = now() where id = p_org returning * into o;
  if o.id is null then raise exception 'escritório não encontrado' using errcode = 'P0002'; end if;
  insert into public.audit_logs (organization_id, actor_id, action, entity, entity_id, detail) values (p_org, auth.uid(), 'status', 'organizations', p_org::text, p_status || coalesce(': ' || p_reason, ''));
  return o;
end $$;
revoke execute on function public.set_organization_status(uuid, text, text) from public, anon;
grant execute on function public.set_organization_status(uuid, text, text) to authenticated;
revoke execute on function public.org_active(uuid) from public, anon;
grant execute on function public.org_active(uuid) to authenticated;
