-- Funções de gatilho não são chamadas por usuários: tirar o EXECUTE padrão de PUBLIC (achado do teste real de
-- privilégios). O gatilho continua disparando (não depende de EXECUTE do usuário). ADITIVA, sem mudança de dados.
revoke execute on function public.conv_ai_mirror() from public, anon, authenticated;
revoke execute on function public.conv_control_sync() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'saas_history_guard') then
    execute 'revoke execute on function public.saas_history_guard() from public, anon, authenticated';
  end if;
end $$;
