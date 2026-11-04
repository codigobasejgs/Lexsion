-- Fecha duas corridas do atendimento automático (ADITIVA):
-- 1) takeover × envio: o portão passa a gravar a "reserva de envio" na própria conversa (sending_job). Assumir a
--    conversa enquanto a reserva existe é aceito, mas a resposta da IA só sai se, NO MOMENTO DO ENVIO, a reserva
--    ainda for daquele trabalho e o modo/versão não mudaram (ai_job_confirm_send). Assumir apaga a reserva.
-- 2) limite diário: a cota é reservada de forma atômica por escritório e dia (ai_quota_take), sem contar depois.
-- Reversão: drop das funções novas e das colunas/tabela; recriar ai_job_claim_send de 20261103150000.

alter table public.conversation_control add column if not exists sending_job bigint;

create or replace function public.ai_job_claim_send(p_job bigint) returns boolean
language plpgsql security definer set search_path = public as $$
declare j public.ai_jobs; c public.conversation_control;
begin
  select * into j from public.ai_jobs where id = p_job for update;
  if j.id is null or j.status <> 'gerando' then return false; end if;
  select * into c from public.conversation_control where organization_id = j.organization_id and conversation_id = j.conversation_id for update;
  if c.mode <> 'ia' or c.version <> j.control_version or c.is_group or c.sending_job is not null then
    update public.ai_jobs set status = 'descartado', reason = 'humano assumiu, conversa mudou ou outro envio em andamento', finished_at = now() where id = j.id;
    return false;
  end if;
  update public.ai_jobs set status = 'enviando' where id = j.id;
  update public.conversation_control set sending_job = j.id where organization_id = j.organization_id and conversation_id = j.conversation_id;
  return true;
end $$;
revoke execute on function public.ai_job_claim_send(bigint) from public, anon, authenticated;
grant execute on function public.ai_job_claim_send(bigint) to service_role;

-- Última conferência, imediatamente antes da chamada ao provedor: a reserva ainda é deste trabalho e nada mudou.
create or replace function public.ai_job_confirm_send(p_job bigint) returns boolean
language plpgsql security definer set search_path = public as $$
declare j public.ai_jobs; c public.conversation_control;
begin
  select * into j from public.ai_jobs where id = p_job;
  select * into c from public.conversation_control where organization_id = j.organization_id and conversation_id = j.conversation_id for update;
  if j.status = 'enviando' and c.sending_job = j.id and c.mode = 'ia' and c.version = j.control_version then return true; end if;
  update public.ai_jobs set status = 'descartado', reason = 'humano assumiu antes do envio', finished_at = now() where id = j.id and status = 'enviando';
  update public.conversation_control set sending_job = null where organization_id = j.organization_id and conversation_id = j.conversation_id and sending_job = j.id;
  return false;
end $$;
revoke execute on function public.ai_job_confirm_send(bigint) from public, anon, authenticated;
grant execute on function public.ai_job_confirm_send(bigint) to service_role;

create or replace function public.ai_job_release_send(p_job bigint) returns void
language sql security definer set search_path = public as $$
  update public.conversation_control set sending_job = null where sending_job = p_job;
$$;
revoke execute on function public.ai_job_release_send(bigint) from public, anon, authenticated;
grant execute on function public.ai_job_release_send(bigint) to service_role;

-- Assumir/devolver/resolver também derruba a reserva de envio em andamento.
create or replace function public.conversation_set_mode(p_org uuid, p_conv text, p_mode text, p_expected int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.conversation_control; n int;
begin
  if not public.has_role(p_org, array['admin','tenant_admin','advogado','atendimento']) then raise exception 'sem permissão para o atendimento' using errcode = '42501'; end if;
  if p_mode not in ('ia','humano','pausado','resolvido') then raise exception 'modo inválido' using errcode = '22023'; end if;
  if not exists (select 1 from public.org_records where organization_id = p_org and collection = 'conversations' and id = p_conv) then raise exception 'conversa não encontrada' using errcode = 'P0002'; end if;
  insert into public.conversation_control (organization_id, conversation_id) values (p_org, p_conv) on conflict do nothing;
  select * into c from public.conversation_control where organization_id = p_org and conversation_id = p_conv for update;
  if c.is_group and p_mode = 'ia' then raise exception 'grupos não são atendidos pela IA' using errcode = '22023'; end if;
  if p_expected is not null and c.version <> p_expected then raise exception 'a conversa mudou; recarregue' using errcode = '40001'; end if;
  update public.conversation_control set mode = p_mode, version = version + 1, sending_job = null, assignee_id = case when p_mode = 'humano' then auth.uid() else assignee_id end, updated_at = now(), updated_by = auth.uid()
    where organization_id = p_org and conversation_id = p_conv returning * into c;
  with x as (update public.ai_jobs set status = 'cancelado', reason = 'atendimento passou para ' || p_mode, finished_at = now()
    where organization_id = p_org and conversation_id = p_conv and status in ('pendente','gerando','enviando','erro') returning 1) select count(*) into n from x;
  insert into public.audit_logs (organization_id, actor_id, action, entity, entity_id, detail)
    values (p_org, auth.uid(), 'conversa.' || p_mode, 'conversations', p_conv, 'modo ' || p_mode || ' (versão ' || c.version || ')' || case when n > 0 then '; ' || n || ' resposta(s) da IA cancelada(s)' else '' end);
  return jsonb_build_object('mode', c.mode, 'version', c.version, 'cancelled', n);
end $$;
revoke execute on function public.conversation_set_mode(uuid, text, text, int) from public, anon;
grant execute on function public.conversation_set_mode(uuid, text, text, int) to authenticated;

-- 2) Cota diária atômica por escritório (UTC). Devolve true se coube.
create table if not exists public.ai_quota (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  day date not null,
  used int not null default 0,
  primary key (organization_id, day)
);
alter table public.ai_quota enable row level security; -- só o servidor
create or replace function public.ai_quota_take(p_org uuid, p_limit int) returns boolean
language plpgsql security definer set search_path = public as $$
declare u int;
begin
  insert into public.ai_quota (organization_id, day, used) values (p_org, (now() at time zone 'utc')::date, 1)
    on conflict (organization_id, day) do update set used = public.ai_quota.used + 1 where public.ai_quota.used < p_limit
    returning used into u;
  return u is not null;
end $$;
revoke execute on function public.ai_quota_take(uuid, int) from public, anon, authenticated;
grant execute on function public.ai_quota_take(uuid, int) to service_role;
