-- Correção P1 (auditoria de 29/10/2026): a política memb_admin deixava o GESTOR (tenant_admin) alterar QUALQUER
-- vínculo do escritório pelo banco direto — promover-se a titular, rebaixar/remover o titular — e o titular podia
-- remover-se sendo o único, deixando o escritório sem dono. A API já recusava; o banco não.
-- Regras (no privilege escalation), aplicadas a usuários do app (auth.uid() presente; serviço/plataforma não passa aqui):
--  1) só o titular (admin) concede, altera ou remove o papel de titular;
--  2) ninguém altera o PRÓPRIO papel (evita autopromoção e autorrebaixamento acidental);
--  3) o escritório nunca fica sem titular (último admin não sai nem é rebaixado);
--  4) gestor não mexe em vínculo de titular.
-- Só adiciona uma trigger; nenhum dado é alterado. Reversão: drop trigger memberships_guard on public.organization_memberships.
create or replace function public.memberships_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  me text := public.my_role(coalesce(new.organization_id, old.organization_id));
  org uuid := coalesce(new.organization_id, old.organization_id);
  admins int;
begin
  if auth.uid() is null then return coalesce(new, old); end if; -- serviço (convite do servidor)
  -- Exclusão do escritório inteiro (cascata da FK): os vínculos saem junto; a regra do último titular não se aplica.
  if tg_op = 'DELETE' and not exists (select 1 from public.organizations where id = old.organization_id) then return old; end if;
  -- Plataforma com 2º fator (create_organization nomeia o titular inicial): governa contratantes, não é usuário do escritório.
  if public.is_platform(array['superadmin','platform_admin']) then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' and new.user_id = auth.uid() and new.role is distinct from old.role then
    raise exception 'ninguém altera o próprio papel; peça a outro titular' using errcode = '42501';
  end if;
  if (tg_op in ('INSERT','UPDATE') and new.role = 'admin') or (tg_op in ('UPDATE','DELETE') and old.role = 'admin') then
    if me is distinct from 'admin' then raise exception 'somente o titular concede, altera ou remove o papel de titular' using errcode = '42501'; end if;
  end if;
  if tg_op in ('UPDATE','DELETE') and old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin') then
    select count(*) into admins from public.organization_memberships where organization_id = org and role = 'admin';
    if admins <= 1 then raise exception 'o escritório precisa de pelo menos um titular; nomeie outro antes' using errcode = '23514'; end if;
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function public.memberships_guard() from public, anon, authenticated;

drop trigger if exists memberships_guard on public.organization_memberships;
create trigger memberships_guard before insert or update or delete on public.organization_memberships
  for each row execute function public.memberships_guard();
