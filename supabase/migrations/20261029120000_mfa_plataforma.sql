-- MFA obrigatório para a PLATAFORMA (Super Admin, admin e suporte): sem segundo fator verificado na sessão (aal2),
-- nenhuma função ou política de plataforma vale. Um único ponto (is_platform) protege as 7 funções e as 6 políticas
-- que dependem dele. TOTP é gratuito no Supabase Auth (plano Free).
-- Efeito: quem é plataforma e ainda não cadastrou TOTP passa a ver o /admin só para cadastrar o fator.
-- Reversão: recriar is_platform sem a condição de aal (o corpo anterior está em 20261028120000_nucleo_multitenant.sql).
create or replace function public.is_platform(roles text[] default array['superadmin','platform_admin','platform_support']) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (select 1 from public.platform_members p where p.user_id = auth.uid() and p.role = any(roles))
$$;

-- Leitura do próprio vínculo de plataforma continua livre (o login precisa saber que o usuário É plataforma para pedir o 2º fator).
