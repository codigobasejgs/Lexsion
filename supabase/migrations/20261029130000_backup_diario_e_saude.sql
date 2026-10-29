-- Plano Free (sem PITR): backup lógico diário cifrado no Cloudflare R2 + monitoramento de saúde sem ferramenta paga.
-- Reaproveita o segredo do cron já guardado no Vault; a URL da rota de backup é derivada da URL do cron jurídico.

-- 1) Disparo do backup (mesmo padrão de trigger_legal_sync: só o cron executa).
create or replace function public.trigger_backup() returns bigint
language plpgsql security definer set search_path = public, extensions, vault as $$
declare secret text; target text; req bigint;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'lexsion_cron_secret';
  select replace(decrypted_secret, '/api/cron/inteligencia', '/api/cron/backup') into target from vault.decrypted_secrets where name = 'lexsion_cron_url';
  if secret is null or target is null then raise exception 'segredo ou URL do cron não configurados no Vault'; end if;
  select net.http_get(url := target, headers := jsonb_build_object('Authorization', 'Bearer ' || secret), timeout_milliseconds := 290000) into req;
  return req;
end $$;
revoke execute on function public.trigger_backup() from public, anon, authenticated;

-- 2) Saúde da operação para o painel do Super Admin (só plataforma com MFA; agregados, nenhum dado de cliente).
create or replace function public.platform_health() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.is_platform() then null else jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'db_limit_bytes', 500 * 1024 * 1024,                -- plano Free
    'storage_bytes', (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects),
    'storage_limit_bytes', 1024 * 1024 * 1024,          -- plano Free
    'users', (select count(*) from auth.users),
    'last_backup_ok', (select max(at) from public.audit_logs where action = 'backup.ok'),
    'last_backup_error', (select max(at) from public.audit_logs where action = 'backup.erro'),
    'last_backup_detail', (select detail from public.audit_logs where action in ('backup.ok','backup.erro') order by at desc limit 1),
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'status', status, 'last_success_at', last_success_at, 'failures', consecutive_failures) order by id), '[]') from public.legal_source_providers where enabled),
    'cron_failures_24h', (select count(*) from cron.job_run_details where status <> 'succeeded' and start_time > now() - interval '24 hours')
  ) end
$$;
revoke execute on function public.platform_health() from public, anon;
grant execute on function public.platform_health() to authenticated;

-- 3) Agendamento: backup diário às 06:17 UTC (03:17 Brasília), fora do horário da coleta jurídica (minuto 7).
do $$ begin
  if exists (select 1 from cron.job where jobname = 'lexsion-backup') then perform cron.unschedule('lexsion-backup'); end if;
  perform cron.schedule('lexsion-backup', '17 6 * * *', 'select public.trigger_backup()');
  -- Histórico do pg_cron cresce sem limite: limpeza semanal (Free tem 500 MB de banco).
  if exists (select 1 from cron.job where jobname = 'lexsion-limpeza-cron') then perform cron.unschedule('lexsion-limpeza-cron'); end if;
  perform cron.schedule('lexsion-limpeza-cron', '41 5 * * 0', $c$delete from cron.job_run_details where end_time < now() - interval '30 days'$c$);
end $$;
