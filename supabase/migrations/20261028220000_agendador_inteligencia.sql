-- Agendador ÚNICO do monitoramento jurídico: Supabase Cron (pg_cron) chama a rota protegida da LexSion por HTTP (pg_net).
-- O segredo do cron fica no Vault (secret "lexsion_cron_secret", gravado fora do Git pelo operador); a URL da rota também.
-- Frequência: a cada 3 horas (configurável). Não é tempo real.
create extension if not exists pg_cron; -- (Supabase)
create extension if not exists pg_net;

create or replace function public.trigger_legal_sync() returns bigint
language plpgsql security definer set search_path = public, extensions, vault as $$
declare secret text; target text; req bigint;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'lexsion_cron_secret';
  select decrypted_secret into target from vault.decrypted_secrets where name = 'lexsion_cron_url';
  if secret is null or target is null then raise exception 'segredo ou URL do cron não configurados no Vault'; end if;
  select net.http_get(url := target, headers := jsonb_build_object('Authorization', 'Bearer ' || secret), timeout_milliseconds := 290000) into req;
  return req;
end $$;
revoke execute on function public.trigger_legal_sync() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'lexsion-inteligencia') then perform cron.unschedule('lexsion-inteligencia'); end if;
  perform cron.schedule('lexsion-inteligencia', '7 */3 * * *', 'select public.trigger_legal_sync()');
end $$;
