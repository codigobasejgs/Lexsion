-- Gestão da equipe da PLATAFORMA pelo Super Admin (ADITIVA). Conceder/alterar/revogar papel interno da LexSion a
-- qualquer conta já cadastrada, com validade e motivo, e restringir por pessoa quais módulos do painel /admin ela vê.
-- Regras: só Super Admin gerencia; nunca fica sem Super Admin; ninguém altera o próprio papel; conteúdo jurídico dos
-- escritórios continua fora do alcance de qualquer papel da plataforma (Anexo III.5). Tudo auditado.
-- Reversão: drop das funções platform_staff*/platform_module_ok e da coluna denied_modules.

alter table public.platform_members add column if not exists denied_modules text[] not null default '{}';

-- Módulos do painel /admin. Mantida em sincronia com src/domain/platform-modules.ts.
create or replace function public.platform_modules() returns text[] language sql immutable as $$
  select array['painel','contratantes','planos','financeiro','contratos','integracoes','suporte','dados','auditoria','equipe']
$$;

-- O usuário da sessão pode usar o módulo? Papel vigente e módulo não restringido para ele.
create or replace function public.platform_module_ok(p_module text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_members p where p.user_id = auth.uid() and (p.expires_at is null or p.expires_at > now())
    and not (p_module = any(p.denied_modules)) and (p_module <> 'equipe' or p.role = 'superadmin'))
$$;
revoke execute on function public.platform_module_ok(text) from public, anon;
grant execute on function public.platform_module_ok(text) to authenticated;

-- A sessão da pessoa precisa conhecer as restrições dela (menu e telas).
create or replace function public.my_access() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', (select nullif(p.full_name, '') from public.profiles p where p.user_id = auth.uid()),
    'platform', (select pm.role from public.platform_members pm where pm.user_id = auth.uid() and (pm.expires_at is null or pm.expires_at > now())),
    'platformDenied', coalesce((select to_jsonb(pm.denied_modules) from public.platform_members pm where pm.user_id = auth.uid() and (pm.expires_at is null or pm.expires_at > now())), '[]'::jsonb),
    'memberships', coalesce((select jsonb_agg(jsonb_build_object('organizationId', o.id, 'name', o.name, 'slug', o.slug, 'status', o.status, 'role', m.role) order by m.created_at)
      from public.organization_memberships m join public.organizations o on o.id = m.organization_id where m.user_id = auth.uid()), '[]'::jsonb),
    'portal', coalesce((select jsonb_agg(jsonb_build_object('organizationId', o.id, 'name', o.name, 'slug', o.slug, 'status', o.status, 'clientId', pl.client_id) order by pl.created_at)
      from public.portal_links pl join public.organizations o on o.id = pl.organization_id where pl.user_id = auth.uid()), '[]'::jsonb))
$$;
revoke execute on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;

-- Lista da equipe da plataforma (só Super Admin).
create or replace function public.platform_staff() returns table (user_id uuid, email text, full_name text, role text, denied_modules text[], expires_at timestamptz, note text, granted_by uuid, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_platform(array['superadmin']) then raise exception 'somente o Super Admin gerencia a equipe da plataforma' using errcode = '42501'; end if;
  return query select p.user_id, u.email::text, nullif(pr.full_name, '')::text, p.role, p.denied_modules, p.expires_at, p.note, p.granted_by, p.created_at, u.last_sign_in_at
    from public.platform_members p join auth.users u on u.id = p.user_id left join public.profiles pr on pr.user_id = p.user_id order by p.created_at;
end $$;
revoke execute on function public.platform_staff() from public, anon;
grant execute on function public.platform_staff() to authenticated;

-- Conceder/alterar (upsert) ou revogar. Conta precisa existir; motivo obrigatório; auditoria com antes/depois.
create or replace function public.platform_staff_set(p_email text, p_role text, p_denied text[], p_expires timestamptz, p_reason text, p_revoke boolean default false) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid; prev public.platform_members; supers int;
begin
  if not public.is_platform(array['superadmin']) then raise exception 'somente o Super Admin gerencia a equipe da plataforma' using errcode = '42501'; end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'informe o motivo (mínimo 5 caracteres)' using errcode = '22023'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'não há conta cadastrada com este e-mail' using errcode = 'P0002'; end if;
  if uid = auth.uid() then raise exception 'você não altera o próprio acesso; peça a outro Super Admin' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('platform_staff')); -- serializa: duas revogações simultâneas não zeram os Super Admins
  select * into prev from public.platform_members where user_id = uid;
  if p_revoke or (p_role is distinct from 'superadmin' and prev.role = 'superadmin') then
    select count(*) into supers from public.platform_members where role = 'superadmin' and (expires_at is null or expires_at > now()) and user_id <> uid;
    if prev.role = 'superadmin' and supers = 0 then raise exception 'a plataforma precisa de ao menos um Super Admin ativo' using errcode = '42501'; end if;
  end if;
  if p_revoke then
    if prev.user_id is null then raise exception 'esta conta não tem acesso à plataforma' using errcode = 'P0002'; end if;
    delete from public.platform_members where user_id = uid;
  else
    if p_role not in ('superadmin','platform_admin','platform_support','platform_finance','platform_auditor') then raise exception 'papel inválido' using errcode = '22023'; end if;
    if p_expires is not null and p_expires <= now() then raise exception 'a validade precisa ser futura' using errcode = '22023'; end if;
    if exists (select 1 from unnest(coalesce(p_denied, '{}')) d where not (d = any(public.platform_modules()))) then raise exception 'módulo desconhecido' using errcode = '22023'; end if;
    insert into public.platform_members (user_id, role, denied_modules, expires_at, note, granted_by)
      values (uid, p_role, coalesce(p_denied, '{}'), p_expires, trim(p_reason), auth.uid())
      on conflict (user_id) do update set role = excluded.role, denied_modules = excluded.denied_modules, expires_at = excluded.expires_at, note = excluded.note, granted_by = excluded.granted_by;
  end if;
  insert into public.audit_logs (organization_id, actor_id, action, entity, entity_id, detail, reason, before, after, actor_role)
    values (null, auth.uid(), case when p_revoke then 'plataforma.acesso_revogado' when prev.user_id is null then 'plataforma.acesso_concedido' else 'plataforma.acesso_alterado' end,
      'platform_members', uid::text, coalesce(p_role, '—'), trim(p_reason),
      case when prev.user_id is null then null else jsonb_build_object('role', prev.role, 'denied', prev.denied_modules, 'expires', prev.expires_at) end,
      case when p_revoke then null else jsonb_build_object('role', p_role, 'denied', coalesce(p_denied, '{}'), 'expires', p_expires) end, 'superadmin');
  return jsonb_build_object('user_id', uid, 'revoked', p_revoke);
end $$;
revoke execute on function public.platform_staff_set(text, text, text[], timestamptz, text, boolean) from public, anon;
grant execute on function public.platform_staff_set(text, text, text[], timestamptz, text, boolean) to authenticated;
