-- Vínculos do próprio usuário, inclusive de escritório suspenso (para a tela explicar o motivo em vez de "sem vínculo").
-- Só dados do próprio usuário; nenhum dado de cliente.
create or replace function public.my_access() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', (select nullif(p.full_name, '') from public.profiles p where p.user_id = auth.uid()),
    'platform', (select pm.role from public.platform_members pm where pm.user_id = auth.uid()),
    'memberships', coalesce((select jsonb_agg(jsonb_build_object('organizationId', o.id, 'name', o.name, 'slug', o.slug, 'status', o.status, 'role', m.role) order by m.created_at)
      from public.organization_memberships m join public.organizations o on o.id = m.organization_id where m.user_id = auth.uid()), '[]'::jsonb),
    'portal', coalesce((select jsonb_agg(jsonb_build_object('organizationId', o.id, 'name', o.name, 'slug', o.slug, 'status', o.status, 'clientId', pl.client_id) order by pl.created_at)
      from public.portal_links pl join public.organizations o on o.id = pl.organization_id where pl.user_id = auth.uid()), '[]'::jsonb))
$$;
revoke execute on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;
