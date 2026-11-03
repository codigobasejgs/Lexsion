-- Cron do atendimento também roda o vigia (instância desconectada, fila morta) uma vez por hora, mesmo sem fila.
-- ADITIVA: só substitui a função de disparo. Reversão: recriar trigger_atendimento de 20261103150000.
create or replace function public.trigger_atendimento() returns bigint
language plpgsql security definer set search_path = public, extensions, vault as $$
declare secret text; target text; req bigint;
begin
  if not exists (select 1 from public.wa_events where status in ('pendente','erro','processando') and attempts < 5)
     and not exists (select 1 from public.ai_jobs where status in ('pendente','gerando','enviando'))
     and not (extract(minute from now()) = 0 and exists (select 1 from public.whatsapp_instances where status in ('desconectado','erro'))) then
    return null;
  end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'lexsion_cron_secret';
  select replace(decrypted_secret, '/api/cron/inteligencia', '/api/cron/atendimento') into target from vault.decrypted_secrets where name = 'lexsion_cron_url';
  if secret is null or target is null then raise exception 'segredo ou URL do cron não configurados no Vault'; end if;
  select net.http_get(url := target, headers := jsonb_build_object('Authorization', 'Bearer ' || secret), timeout_milliseconds := 110000) into req;
  return req;
end $$;
revoke execute on function public.trigger_atendimento() from public, anon, authenticated;
