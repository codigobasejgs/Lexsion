-- Prefixo "qa-" reservado a escritórios SINTÉTICOS de teste (o cadastro público recusa; ver /api/contrato).
-- A trilha de eliminação continua permanente para escritórios reais; só a de escritório sintético "qa-" pode ser
-- removida, e só pelo servidor (sem usuário logado), para os testes contra produção não deixarem resíduo.
create or replace function public.data_erasures_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if auth.uid() is null and old.org_slug like 'qa-%' then return old; end if;
    raise exception 'trilha de eliminação é permanente' using errcode = '42501';
  end if;
  if new.organization_id <> old.organization_id or new.requested_by <> old.requested_by or new.reason <> old.reason or new.preview <> old.preview or new.closed_at <> old.closed_at then
    raise exception 'campos do pedido de eliminação são imutáveis' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.data_erasures_guard() from public, anon, authenticated;
