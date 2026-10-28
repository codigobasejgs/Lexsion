-- Ícones públicos ficam em marcas/slug-<slug>/… (o manifesto é montado sem login e só conhece o slug).
-- Autorização: titular do escritório DAQUELE slug, ou a plataforma.
create or replace function public.can_manage_brand_path(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organizations o
    where 'slug-' || o.slug = (storage.foldername(p_name))[1]
      and (public.has_role(o.id, array['admin']) or public.is_platform(array['superadmin','platform_admin'])))
$$;
revoke execute on function public.can_manage_brand_path(text) from public, anon;
grant execute on function public.can_manage_brand_path(text) to authenticated;

drop policy if exists marcas_write on storage.objects;
create policy marcas_write on storage.objects for insert to authenticated with check (bucket_id = 'marcas' and public.can_manage_brand_path(name));
drop policy if exists marcas_update on storage.objects;
create policy marcas_update on storage.objects for update to authenticated using (bucket_id = 'marcas' and public.can_manage_brand_path(name)) with check (bucket_id = 'marcas' and public.can_manage_brand_path(name));
drop policy if exists marcas_delete on storage.objects;
create policy marcas_delete on storage.objects for delete to authenticated using (bucket_id = 'marcas' and public.can_manage_brand_path(name));
