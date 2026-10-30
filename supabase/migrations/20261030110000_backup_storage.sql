-- Backup integral (plano Free): além das tabelas, os ARQUIVOS do Storage entram no backup cifrado do R2.
-- O servidor (chave secreta) precisa do índice de objetos; storage.objects não é exposto pela API REST.
-- Só leitura de metadados; nenhum dado é alterado. Reversão: drop function public.backup_storage_index().
create or replace function public.backup_storage_index() returns table (bucket_id text, name text, id uuid, size bigint, mimetype text, updated_at timestamptz)
language sql stable security definer set search_path = public, storage as $$
  select o.bucket_id, o.name, o.id, coalesce((o.metadata->>'size')::bigint, 0), o.metadata->>'mimetype', coalesce(o.updated_at, o.created_at)
  from storage.objects o where o.bucket_id in ('documentos', 'marcas') order by o.bucket_id, o.name
$$;
revoke execute on function public.backup_storage_index() from public, anon, authenticated;
grant execute on function public.backup_storage_index() to service_role;
