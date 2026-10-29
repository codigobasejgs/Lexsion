-- Correção (auditoria de 29/10/2026): trocar o logotipo falhava com "new row violates row-level security policy".
-- O upload com upsert do Storage é INSERT … ON CONFLICT DO UPDATE e exige política SELECT na linha existente;
-- o bucket "marcas" só tinha INSERT/UPDATE/DELETE. A primeira publicação passava e as seguintes eram recusadas.
-- SELECT restrito a quem já pode gerir a marca daquele slug (o arquivo é público pela CDN de qualquer forma).
-- Só cria política; nenhum dado é alterado. Reversível: drop policy marcas_select on storage.objects.
drop policy if exists marcas_select on storage.objects;
create policy marcas_select on storage.objects for select to authenticated using (bucket_id = 'marcas' and public.can_manage_brand_path(name));
