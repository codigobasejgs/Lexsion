-- Decisão do proprietário (03/11/2026): a administração da plataforma NÃO exige mais aplicativo autenticador (TOTP).
-- Só muda a condição de sessão (aal2) de is_platform e platform_role; papel, validade do vínculo, RLS, RBAC interno e
-- auditoria continuam iguais. Fatores TOTP já cadastrados não são apagados (ficam sem uso).
-- Reversão: reaplicar 20261030160000_super_admin_gerencial.sql (versão com aal2).
create or replace function public.is_platform(roles text[] default array['superadmin','platform_admin','platform_support','platform_finance','platform_auditor']) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_members p where p.user_id = auth.uid() and p.role = any(roles) and (p.expires_at is null or p.expires_at > now()))
$$;
create or replace function public.platform_role() returns text
language sql stable security definer set search_path = public as $$
  select p.role from public.platform_members p
  where p.user_id = auth.uid() and (p.expires_at is null or p.expires_at > now())
$$;
revoke execute on function public.platform_role() from public, anon;
grant execute on function public.platform_role() to authenticated;

-- Mensagem do núcleo das ações administrativas sem a menção ao segundo fator (corpo igual ao de 20261030161000).
create or replace function public.platform_lock_org(p_org uuid, p_expected timestamptz, p_roles text[]) returns public.organizations
language plpgsql security definer set search_path = public as $$
declare o public.organizations;
begin
  if not public.is_platform(p_roles) then raise exception 'sem permissão para esta ação (exige papel de administração da plataforma)' using errcode = '42501'; end if;
  select * into o from public.organizations where id = p_org for update;
  if o.id is null then raise exception 'escritório não encontrado' using errcode = 'P0002'; end if;
  if p_expected is not null and date_trunc('milliseconds', o.updated_at) <> date_trunc('milliseconds', p_expected) then
    raise exception 'o escritório foi alterado por outra pessoa; recarregue e confira antes de repetir' using errcode = '40001';
  end if;
  return o;
end $$;
revoke execute on function public.platform_lock_org(uuid, timestamptz, text[]) from public, anon, authenticated;
