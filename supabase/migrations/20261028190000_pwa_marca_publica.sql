-- PWA white-label do escritório REAL: manifesto e ícones servidos sem login (o navegador busca o manifesto sem sessão).
-- Só dados de MARCA, que já são públicos por natureza (nome fantasia, cores, ícone). Nada de cliente/caso/financeiro.

-- Marca pública de escritório ativo. Sem sessão (anon) porque o manifesto é pedido antes do login.
create or replace function public.public_brand(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'slug', o.slug,
    'name', o.name,
    'brandName', coalesce(nullif(o.branding->>'brandName', ''), o.name),
    'pwaShortName', coalesce(nullif(o.branding->>'pwaShortName', ''), left(o.name, 12)),
    'primary', o.branding->>'primary',
    'backgroundDark', o.branding->>'backgroundDark',
    'backgroundLight', o.branding->>'backgroundLight',
    'themeMode', o.branding->>'themeMode',
    'iconVersion', coalesce((o.branding->>'brandingVersion')::int, 1),
    'hasIcon', coalesce((o.branding->>'hasPublicIcon')::boolean, false))
  from public.organizations o
  where o.slug = p_slug and o.status in ('ativa', 'trial')
$$;
revoke execute on function public.public_brand(text) from public;
grant execute on function public.public_brand(text) to anon, authenticated;

-- Bucket PÚBLICO só para ícones/logos de marca: PNG, até 1 MB, caminho <organization_id>/<arquivo>.png.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marcas', 'marcas', true, 1048576, array['image/png'])
on conflict (id) do nothing;

-- Grava/troca ícone: só quem gere a marca do PRÓPRIO escritório (titular) ou a plataforma.
drop policy if exists marcas_write on storage.objects;
create policy marcas_write on storage.objects for insert to authenticated
  with check (bucket_id = 'marcas' and (public.has_role(((storage.foldername(name))[1])::uuid, array['admin']) or public.is_platform(array['superadmin','platform_admin'])));
drop policy if exists marcas_update on storage.objects;
create policy marcas_update on storage.objects for update to authenticated
  using (bucket_id = 'marcas' and (public.has_role(((storage.foldername(name))[1])::uuid, array['admin']) or public.is_platform(array['superadmin','platform_admin'])))
  with check (bucket_id = 'marcas' and (public.has_role(((storage.foldername(name))[1])::uuid, array['admin']) or public.is_platform(array['superadmin','platform_admin'])));
drop policy if exists marcas_delete on storage.objects;
create policy marcas_delete on storage.objects for delete to authenticated
  using (bucket_id = 'marcas' and (public.has_role(((storage.foldername(name))[1])::uuid, array['admin']) or public.is_platform(array['superadmin','platform_admin'])));
-- Leitura do bucket público é feita pela URL pública do Storage (não precisa de policy de select).

-- A marca não guarda mais imagem embutida no banco quando há ícone público: evita linha grande e vazamento por engano.
comment on function public.public_brand(text) is 'Somente marca pública (nome, cores, ícone) de escritório ativo, para manifesto PWA sem login.';
