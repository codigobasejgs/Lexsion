-- Ações do Super Admin (operação real): UMA função por ação, transacional, com trava de linha, versão esperada
-- (updated_at) contra edição concorrente, chave de idempotência contra duplo clique e auditoria com antes/depois/motivo.
-- Chamadas com a sessão do administrador (RLS/aal2 conferidos aqui dentro). Reversão: drop das funções.

-- Núcleo: confere papel, trava o escritório e checa a versão; devolve o estado anterior.
create or replace function public.platform_lock_org(p_org uuid, p_expected timestamptz, p_roles text[]) returns public.organizations
language plpgsql security definer set search_path = public as $$
declare o public.organizations;
begin
  if not public.is_platform(p_roles) then raise exception 'sem permissão para esta ação (exige papel e verificação em duas etapas)' using errcode = '42501'; end if;
  select * into o from public.organizations where id = p_org for update;
  if o.id is null then raise exception 'escritório não encontrado' using errcode = 'P0002'; end if;
  if p_expected is not null and date_trunc('milliseconds', o.updated_at) <> date_trunc('milliseconds', p_expected) then
    raise exception 'o escritório foi alterado por outra pessoa; recarregue e confira antes de repetir' using errcode = '40001';
  end if;
  return o;
end $$;
revoke execute on function public.platform_lock_org(uuid, timestamptz, text[]) from public, anon, authenticated;

create or replace function public.platform_audit(p_org uuid, p_action text, p_before jsonb, p_after jsonb, p_reason text, p_detail text) returns void
language sql security definer set search_path = public as $$
  insert into public.audit_logs (organization_id, actor_id, actor_role, action, entity, entity_id, detail, reason, before, after)
  values (p_org, auth.uid(), public.platform_role(), p_action, 'organizations', p_org::text, left(p_detail, 500), left(p_reason, 500), p_before, p_after)
$$;
revoke execute on function public.platform_audit(uuid, text, jsonb, jsonb, text, text) from public, anon, authenticated;

-- Teste grátis: conceder/prorrogar/definir data/reativar/encerrar. Atualiza escritório, assinatura e histórico juntos.
create or replace function public.platform_trial(p_org uuid, p_op text, p_days int, p_until timestamptz, p_reason text, p_expected timestamptz, p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.organizations; old_end timestamptz; new_end timestamptz; base timestamptz; kind text; prev jsonb;
begin
  if p_key is not null and exists (select 1 from public.saas_trial_grants where idempotency_key = p_key) then
    return (select jsonb_build_object('ok', true, 'repeated', true, 'new_end', g.new_end) from public.saas_trial_grants g where g.idempotency_key = p_key);
  end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'informe o motivo (mínimo 5 caracteres)' using errcode = '23514'; end if;
  o := public.platform_lock_org(p_org, p_expected, array['superadmin','platform_admin']);
  if o.status = 'cancelada' then raise exception 'escritório cancelado: reative antes' using errcode = '22023'; end if;
  old_end := nullif(o.meta->>'trialEndsAt', '')::timestamptz;
  prev := jsonb_build_object('status', o.status, 'plan', o.plan, 'trialEndsAt', old_end);
  if p_op in ('conceder','prorrogar','reativar') then
    if p_days is null or p_days < 1 or p_days > 365 then raise exception 'dias entre 1 e 365' using errcode = '22023'; end if;
    -- Prorrogar soma ao fim atual (se ainda no futuro); conceder/reativar contam de agora.
    base := case when p_op = 'prorrogar' and old_end > now() then old_end else now() end;
    -- Fim do dia em Brasília: o escritório tem o dia inteiro.
    new_end := ((date_trunc('day', (base + make_interval(days => p_days)) at time zone 'America/Sao_Paulo') + interval '23 hours 59 minutes 59 seconds') at time zone 'America/Sao_Paulo');
    kind := case p_op when 'conceder' then 'concessao' when 'prorrogar' then 'extensao' else 'reativacao' end;
  elsif p_op = 'definir' then
    if p_until is null or p_until <= now() or p_until > now() + interval '366 days' then raise exception 'data final entre amanhã e 1 ano' using errcode = '22023'; end if;
    new_end := p_until; kind := 'data_definida';
  elsif p_op = 'encerrar' then
    if o.status <> 'trial' then raise exception 'escritório não está em teste' using errcode = '22023'; end if;
    new_end := now(); kind := 'encerramento';
  else raise exception 'operação inválida' using errcode = '22023';
  end if;
  if p_op = 'prorrogar' and o.status not in ('trial','inadimplente','suspensa') and old_end is null then raise exception 'escritório sem teste para prorrogar; use conceder' using errcode = '22023'; end if;
  if o.status = 'ativa' and exists (select 1 from public.saas_subscriptions s where s.organization_id = p_org and s.status = 'ativa') and p_op <> 'encerrar' then
    raise exception 'escritório com assinatura paga ativa: teste não se aplica' using errcode = '22023';
  end if;
  update public.organizations set
    status = case when p_op = 'encerrar' then 'suspensa' else 'trial' end,
    status_reason = case when p_op = 'encerrar' then 'Teste encerrado: ' || left(trim(p_reason), 200) else null end,
    meta = meta || jsonb_build_object('trialEndsAt', new_end, 'origem', coalesce(meta->>'origem', 'super_admin')),
    updated_at = now()
  where id = p_org returning * into o;
  update public.saas_subscriptions set current_period_end = (new_end at time zone 'America/Sao_Paulo')::date,
    status = case when p_op = 'encerrar' then 'suspensa' else 'teste' end, updated_at = now()
  where organization_id = p_org and status in ('teste','vencida','suspensa');
  insert into public.saas_trial_grants (organization_id, kind, old_end, new_end, days, reason, actor_id, idempotency_key)
  values (p_org, kind, old_end, new_end, p_days, trim(p_reason), auth.uid(), p_key);
  perform public.platform_audit(p_org, 'teste.' || kind, prev, jsonb_build_object('status', o.status, 'trialEndsAt', new_end), p_reason,
    'teste ' || kind || ': ' || coalesce(to_char(old_end at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'), '—') || ' → ' || to_char(new_end at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'));
  return jsonb_build_object('ok', true, 'old_end', old_end, 'new_end', new_end, 'status', o.status, 'updated_at', o.updated_at);
end $$;

-- Cortesia: acesso sem pagamento, com validade obrigatória. NÃO cria assinatura paga nem receita.
create or replace function public.platform_courtesy(p_org uuid, p_op text, p_until timestamptz, p_reason text, p_expected timestamptz, p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.organizations; prev jsonb;
begin
  if p_key is not null and exists (select 1 from public.saas_trial_grants where idempotency_key = p_key) then return jsonb_build_object('ok', true, 'repeated', true); end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'informe o motivo (mínimo 5 caracteres)' using errcode = '23514'; end if;
  o := public.platform_lock_org(p_org, p_expected, array['superadmin']); -- cortesia: só o proprietário
  prev := jsonb_build_object('status', o.status, 'courtesyUntil', o.meta->>'courtesyUntil');
  if p_op = 'conceder' then
    if p_until is null or p_until <= now() or p_until > now() + interval '366 days' then raise exception 'cortesia exige validade entre amanhã e 1 ano' using errcode = '22023'; end if;
    update public.organizations set status = 'ativa', status_reason = null, meta = meta || jsonb_build_object('courtesyUntil', p_until, 'courtesyReason', left(trim(p_reason), 200)), updated_at = now() where id = p_org returning * into o;
    insert into public.saas_trial_grants (organization_id, kind, old_end, new_end, reason, actor_id, idempotency_key) values (p_org, 'cortesia', nullif(prev->>'courtesyUntil','')::timestamptz, p_until, trim(p_reason), auth.uid(), p_key);
  elsif p_op = 'encerrar' then
    if o.meta->>'courtesyUntil' is null then raise exception 'escritório sem cortesia' using errcode = '22023'; end if;
    update public.organizations set meta = meta - 'courtesyUntil' - 'courtesyReason',
      status = case when exists (select 1 from public.saas_subscriptions s where s.organization_id = p_org and s.status = 'ativa') then 'ativa' else 'suspensa' end,
      status_reason = case when exists (select 1 from public.saas_subscriptions s where s.organization_id = p_org and s.status = 'ativa') then null else 'Cortesia encerrada: ' || left(trim(p_reason), 200) end,
      updated_at = now() where id = p_org returning * into o;
    insert into public.saas_trial_grants (organization_id, kind, old_end, new_end, reason, actor_id, idempotency_key) values (p_org, 'fim_cortesia', nullif(prev->>'courtesyUntil','')::timestamptz, now(), trim(p_reason), auth.uid(), p_key);
  else raise exception 'operação inválida' using errcode = '22023';
  end if;
  perform public.platform_audit(p_org, 'cortesia.' || p_op, prev, jsonb_build_object('status', o.status, 'courtesyUntil', o.meta->>'courtesyUntil'), p_reason, 'cortesia ' || p_op || ' (sem pagamento, não conta como receita)');
  return jsonb_build_object('ok', true, 'status', o.status, 'updated_at', o.updated_at);
end $$;

-- Plano administrativo: troca plano/limites do escritório. Sem cobrança automática; não altera preço contratado
-- nem cria pagamento. Para assinatura paga, a troca vale na próxima renovação (change_request) salvo "imediato".
create or replace function public.platform_set_plan(p_org uuid, p_plan text, p_mode text, p_reason text, p_expected timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.organizations; p public.saas_plans; prev jsonb; s public.saas_subscriptions;
begin
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'informe o motivo (mínimo 5 caracteres)' using errcode = '23514'; end if;
  o := public.platform_lock_org(p_org, p_expected, array['superadmin','platform_admin']);
  if p_plan not in ('trial','essencial','profissional','avancado','enterprise') then
    select * into p from public.saas_plans where id = p_plan;
    if p.id is null then raise exception 'plano inválido' using errcode = '22023'; end if;
  end if;
  select * into s from public.saas_subscriptions where organization_id = p_org for update;
  prev := jsonb_build_object('plan', o.plan, 'sub_plan', s.plan_id, 'max_users', s.max_users, 'change_request', s.change_request);
  if s.organization_id is not null and s.status = 'ativa' and p_mode = 'proxima_renovacao' then
    update public.saas_subscriptions set change_request = jsonb_build_object('plan', p_plan, 'at', now(), 'by', auth.uid(), 'origem', 'super_admin'), updated_at = now() where organization_id = p_org;
  else
    update public.organizations set plan = p_plan, updated_at = now() where id = p_org returning * into o;
    -- Assinatura existente: limites do novo plano já; preço contratado NÃO muda (snapshot) — próxima cobrança usa change_request.
    if s.organization_id is not null and p.id is not null then
      update public.saas_subscriptions set plan_id = p.id, max_users = p.max_users,
        change_request = case when s.status = 'ativa' then jsonb_build_object('plan', p.id, 'at', now(), 'by', auth.uid(), 'origem', 'super_admin_imediato') else change_request end,
        updated_at = now() where organization_id = p_org;
    end if;
  end if;
  perform public.platform_audit(p_org, 'plano.alterado', prev, jsonb_build_object('plan', p_plan, 'mode', p_mode), p_reason,
    o.plan || ' → ' || p_plan || ' (' || p_mode || '); sem cobrança automática');
  return jsonb_build_object('ok', true, 'plan', o.plan, 'updated_at', o.updated_at);
end $$;

-- Suspender / reativar / cancelar (dados sempre preservados).
create or replace function public.platform_set_status(p_org uuid, p_status text, p_reason text, p_expected timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.organizations; prev jsonb; trial_end timestamptz;
begin
  if p_status not in ('ativa','trial','suspensa','cancelada') then raise exception 'situação inválida' using errcode = '22023'; end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'informe o motivo (mínimo 5 caracteres)' using errcode = '23514'; end if;
  o := public.platform_lock_org(p_org, p_expected, array['superadmin','platform_admin']);
  prev := jsonb_build_object('status', o.status, 'reason', o.status_reason);
  trial_end := nullif(o.meta->>'trialEndsAt', '')::timestamptz;
  -- Reativar volta ao estado que o escritório tem direito: assinatura paga/cortesia → ativa; teste vigente → trial.
  if p_status in ('ativa','trial') then
    p_status := case
      when exists (select 1 from public.saas_subscriptions s where s.organization_id = p_org and s.status in ('ativa','vencida','suspensa') and s.current_period_end >= current_date and s.price >= 100 and exists (select 1 from public.saas_orders x where x.organization_id = p_org and x.status = 'pago')) then 'ativa'
      when (o.meta->>'courtesyUntil')::timestamptz > now() then 'ativa'
      when trial_end > now() then 'trial'
      when p_status = 'ativa' and not exists (select 1 from public.saas_subscriptions s where s.organization_id = p_org) then 'ativa' -- escritório criado pela plataforma sem venda pelo site
      else null end;
    if p_status is null then raise exception 'sem direito vigente (teste vencido, sem pagamento confirmado nem cortesia): conceda teste ou cortesia antes de reativar' using errcode = '22023'; end if;
    update public.saas_subscriptions set status = case when status = 'suspensa' and current_period_end >= current_date then (case when p_status = 'trial' then 'teste' else 'ativa' end) else status end, updated_at = now() where organization_id = p_org;
  else
    update public.saas_subscriptions set status = case when p_status = 'cancelada' then 'cancelada' else 'suspensa' end, updated_at = now() where organization_id = p_org and status <> 'cancelada';
  end if;
  update public.organizations set status = p_status, status_reason = case when p_status in ('suspensa','cancelada') then left(trim(p_reason), 300) else null end, updated_at = now() where id = p_org returning * into o;
  perform public.platform_audit(p_org, 'status', prev, jsonb_build_object('status', o.status), p_reason, prev->>'status' || ' → ' || o.status || ' (dados preservados)');
  return jsonb_build_object('ok', true, 'status', o.status, 'updated_at', o.updated_at);
end $$;

-- Limite extra temporário de usuários.
create or replace function public.platform_override(p_org uuid, p_value int, p_until timestamptz, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.organizations;
begin
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'informe o motivo (mínimo 5 caracteres)' using errcode = '23514'; end if;
  o := public.platform_lock_org(p_org, null, array['superadmin','platform_admin']);
  update public.saas_entitlement_overrides set revoked_at = now() where organization_id = p_org and key = 'max_users' and revoked_at is null;
  if p_value is not null then
    if p_until is not null and p_until <= now() then raise exception 'validade no futuro' using errcode = '22023'; end if;
    insert into public.saas_entitlement_overrides (organization_id, key, value, until, reason, actor_id) values (p_org, 'max_users', p_value, p_until, trim(p_reason), auth.uid());
  end if;
  perform public.platform_audit(p_org, 'limite.usuarios', null, jsonb_build_object('max_users', p_value, 'until', p_until), p_reason, coalesce('limite de usuários: ' || p_value, 'limite extra revogado'));
  return jsonb_build_object('ok', true);
end $$;

-- Painel: escritórios com status, teste, plano, uso, titular, último acesso e pagamento (sem conteúdo jurídico).
create or replace function public.platform_orgs() returns table (
  id uuid, slug text, name text, status text, status_reason text, plan text, created_at timestamptz, updated_at timestamptz,
  trial_ends_at timestamptz, courtesy_until timestamptz, origem text, owner_name text, owner_email text, owner_last_sign_in timestamptz, owner_confirmed boolean,
  members int, max_users int, clients int, storage_bytes bigint, last_activity timestamptz,
  sub_status text, sub_cycle text, sub_price int, period_end date, cancel_at_period_end boolean, last_paid_at timestamptz, open_order boolean, has_pwa_icon boolean)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_platform() then raise exception 'somente a plataforma' using errcode = '42501'; end if;
  return query
  with own as (select distinct on (m.organization_id) m.organization_id, m.user_id from public.organization_memberships m where m.role = 'admin' order by m.organization_id, m.created_at)
  select o.id, o.slug, o.name, o.status, o.status_reason, o.plan, o.created_at, o.updated_at,
    nullif(o.meta->>'trialEndsAt','')::timestamptz, nullif(o.meta->>'courtesyUntil','')::timestamptz, (o.meta->>'origem')::text,
    coalesce(nullif(p.full_name,''), o.meta->>'ownerName')::text, coalesce(u.email::text, o.meta->>'ownerEmail')::text, u.last_sign_in_at::timestamptz, (u.email_confirmed_at is not null),
    (select count(*)::int from public.organization_memberships m where m.organization_id = o.id),
    coalesce((select max(v.value) from public.saas_entitlement_overrides v where v.organization_id = o.id and v.revoked_at is null and (v.until is null or v.until > now())), s.max_users)::int,
    (select count(*)::int from public.org_records r where r.organization_id = o.id and r.collection = 'clients'),
    (select coalesce(sum((so.metadata->>'size')::bigint), 0)::bigint from storage.objects so where so.bucket_id = 'documentos' and so.name like o.id::text || '/%'),
    (select max(a.at) from public.audit_logs a where a.organization_id = o.id and a.actor_id is not null and a.actor_id in (select m.user_id from public.organization_memberships m where m.organization_id = o.id)),
    case when public.is_platform(array['superadmin','platform_admin','platform_finance','platform_auditor']) then s.status end,
    s.cycle,
    case when public.is_platform(array['superadmin','platform_admin','platform_finance','platform_auditor']) then s.price end,
    s.current_period_end, s.cancel_at_period_end,
    (select max(x.paid_at) from public.saas_orders x where x.organization_id = o.id and x.status = 'pago'),
    exists (select 1 from public.saas_orders x where x.organization_id = o.id and x.status = 'pendente'),
    coalesce((o.branding->>'hasPublicIcon')::boolean, false)
  from public.organizations o
  left join own on own.organization_id = o.id
  left join auth.users u on u.id = own.user_id
  left join public.profiles p on p.user_id = own.user_id
  left join public.saas_subscriptions s on s.organization_id = o.id
  order by o.created_at desc;
end $$;

-- Indicadores com fórmulas declaradas (docs/PRODUCAO_REAL/18). Só dados reais; concessões fora da receita.
create or replace function public.platform_metrics(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365))); fin boolean;
begin
  if not public.is_platform() then raise exception 'somente a plataforma' using errcode = '42501'; end if;
  fin := public.is_platform(array['superadmin','platform_admin','platform_finance','platform_auditor']);
  return jsonb_build_object(
    'generated_at', now(), 'days', p_days,
    'orgs_total', (select count(*) from public.organizations),
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from public.organizations group by 1) x),
    'trial_ending_7d', (select count(*) from public.organizations o where o.status = 'trial' and nullif(o.meta->>'trialEndsAt','')::timestamptz between now() and now() + interval '7 days'),
    'trial_expired', (select count(*) from public.organizations o where o.status = 'trial' and nullif(o.meta->>'trialEndsAt','')::timestamptz < now()),
    'courtesy', (select count(*) from public.organizations o where nullif(o.meta->>'courtesyUntil','')::timestamptz > now()),
    'new_orgs', (select count(*) from public.organizations where created_at >= since),
    'invites_pending', (select count(*) from public.organization_memberships m join auth.users u on u.id = m.user_id where m.role = 'admin' and u.last_sign_in_at is null),
    'by_plan', (select coalesce(jsonb_object_agg(plan, n), '{}') from (select plan, count(*) n from public.organizations group by 1) x),
    -- MRR: assinaturas 'ativa' com ao menos um pagamento confirmado; anual ÷ 12. Teste e cortesia ficam fora.
    'mrr', case when fin then (select coalesce(sum(case when s.cycle = 'anual' then round(s.price / 12.0) else s.price end), 0) from public.saas_subscriptions s
            where s.status = 'ativa' and exists (select 1 from public.saas_orders x where x.organization_id = s.organization_id and x.status = 'pago')) end,
    'paying', (select count(*) from public.saas_subscriptions s where s.status = 'ativa' and exists (select 1 from public.saas_orders x where x.organization_id = s.organization_id and x.status = 'pago')),
    'paid_in_period', case when fin then (select coalesce(sum(amount), 0) from public.saas_orders where status = 'pago' and paid_at >= since) end,
    'paid_count', (select count(*) from public.saas_orders where status = 'pago' and paid_at >= since),
    'pending_amount', case when fin then (select coalesce(sum(amount), 0) from public.saas_orders where status = 'pendente') end,
    'refunded_in_period', case when fin then (select coalesce(sum(amount), 0) from public.saas_orders where status = 'estornado' and updated_at >= since) end,
    'paid_without_activation', (select count(*) from public.saas_orders where status in ('pago','teste') and activation <> 'concluida'),
    -- Churn: assinaturas canceladas no período ÷ assinaturas pagantes no início do período (aprox.: pagantes atuais + canceladas no período).
    'canceled_in_period', (select count(*) from public.audit_logs where action in ('assinatura.cancelada','status') and detail like '%cancelada%' and at >= since),
    -- Conversão: escritórios que tiveram teste e hoje têm assinatura paga ÷ escritórios que tiveram teste.
    'trials_ever', (select count(distinct organization_id) from public.saas_trial_grants) + (select count(*) from public.saas_orders where status = 'teste' and organization_id is not null and organization_id not in (select organization_id from public.saas_trial_grants)),
    'trials_converted', (select count(distinct x.organization_id) from public.saas_orders x where x.status = 'pago' and x.organization_id in (
        select organization_id from public.saas_trial_grants union select organization_id from public.saas_orders where status = 'teste' and organization_id is not null)),
    'funnel', jsonb_build_object(
      'contratos_criados', (select count(*) from public.saas_contracts where created_at >= since),
      'contratos_aceitos', (select count(*) from public.saas_contracts where accepted_at >= since),
      'pedidos', (select count(*) from public.saas_orders where created_at >= since and kind = 'contratacao'),
      'pagos', (select count(*) from public.saas_orders where paid_at >= since and kind = 'contratacao'),
      'testes', (select count(*) from public.saas_orders where created_at >= since and status = 'teste'),
      'ativados', (select count(*) from public.saas_orders where updated_at >= since and activation = 'concluida' and kind = 'contratacao')),
    'support_open', (select count(*) from public.platform_records where collection = 'supportTickets' and coalesce(data->>'status','aberto') <> 'resolvido')
  );
end $$;

-- Histórico 360º de um escritório (auditoria + concessões), sem conteúdo jurídico.
create or replace function public.platform_org_timeline(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform() then raise exception 'somente a plataforma' using errcode = '42501'; end if;
  return jsonb_build_object(
    'events', (select coalesce(jsonb_agg(e order by e.at desc), '[]') from (select a.at, a.action, a.detail, a.reason, a.before, a.after, a.actor_role,
                 (select coalesce(nullif(p.full_name,''), 'usuário') from public.profiles p where p.user_id = a.actor_id) actor
               from public.audit_logs a where a.organization_id = p_org and (a.entity in ('organizations','saas_orders','saas_subscriptions','comercial') or a.action like 'assinatura.%' or a.action like 'teste.%') order by a.at desc limit 200) e),
    'grants', (select coalesce(jsonb_agg(g order by g.created_at desc), '[]') from public.saas_trial_grants g where g.organization_id = p_org),
    'overrides', (select coalesce(jsonb_agg(v order by v.created_at desc), '[]') from public.saas_entitlement_overrides v where v.organization_id = p_org),
    'team', (select coalesce(jsonb_agg(jsonb_build_object('role', m.role, 'name', coalesce(nullif(pr.full_name,''), '—'), 'email', u.email, 'last_sign_in', u.last_sign_in_at, 'confirmed', u.email_confirmed_at is not null) order by m.created_at), '[]')
             from public.organization_memberships m left join auth.users u on u.id = m.user_id left join public.profiles pr on pr.user_id = m.user_id where m.organization_id = p_org),
    'orders', case when public.is_platform(array['superadmin','platform_admin','platform_finance','platform_auditor']) then
             (select coalesce(jsonb_agg(jsonb_build_object('order_nsu', x.order_nsu, 'kind', x.kind, 'amount', x.amount, 'status', x.status, 'paid_at', x.paid_at, 'created_at', x.created_at, 'activation', x.activation) order by x.created_at desc), '[]') from public.saas_orders x where x.organization_id = p_org) else '[]'::jsonb end,
    'contracts', (select coalesce(jsonb_agg(jsonb_build_object('number', c.number, 'status', c.status, 'accepted_at', c.accepted_at) order by c.created_at desc), '[]') from public.saas_contracts c where c.organization_id = p_org)
  );
end $$;

-- Expiração automática (cron diário de cobrança): teste/cortesia vencidos ⇒ suspensão SEM apagar dados. Idempotente.
create or replace function public.saas_expire_access() returns jsonb
language plpgsql security definer set search_path = public as $$
declare n_trial int; n_court int;
begin
  with x as (
    update public.organizations o set status = 'suspensa', status_reason = 'Teste grátis encerrado em ' || to_char((o.meta->>'trialEndsAt')::timestamptz at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'), updated_at = now()
    where o.status = 'trial' and nullif(o.meta->>'trialEndsAt','')::timestamptz < now()
      and not exists (select 1 from public.saas_orders p where p.organization_id = o.id and p.kind = 'renovacao' and p.status = 'pago')
    returning o.id, (o.meta->>'trialEndsAt')::timestamptz e)
  , g as (insert into public.saas_trial_grants (organization_id, kind, old_end, new_end, reason, idempotency_key)
    select id, 'expiracao_automatica', e, e, 'Fim do teste grátis (rotina diária)', 'exp-' || id || '-' || e from x on conflict (idempotency_key) do nothing returning 1)
  , a as (insert into public.audit_logs (organization_id, actor_id, action, entity, entity_id, detail, before, after)
    select id, null, 'teste.expirado', 'organizations', id::text, 'teste vencido: acesso suspenso, dados preservados', jsonb_build_object('status','trial'), jsonb_build_object('status','suspensa') from x returning 1)
  select count(*) into n_trial from x;
  with y as (
    update public.organizations o set status = 'suspensa', status_reason = 'Cortesia encerrada em ' || to_char((o.meta->>'courtesyUntil')::timestamptz at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'),
      meta = meta - 'courtesyUntil' - 'courtesyReason', updated_at = now()
    where nullif(o.meta->>'courtesyUntil','')::timestamptz < now() and o.status = 'ativa'
      and not exists (select 1 from public.saas_subscriptions s where s.organization_id = o.id and s.status = 'ativa')
    returning o.id)
  , a2 as (insert into public.audit_logs (organization_id, actor_id, action, entity, entity_id, detail) select id, null, 'cortesia.expirada', 'organizations', id::text, 'cortesia vencida: acesso suspenso, dados preservados' from y returning 1)
  select count(*) into n_court from y;
  return jsonb_build_object('testes_expirados', n_trial, 'cortesias_expiradas', n_court);
end $$;

revoke execute on function public.platform_trial(uuid, text, int, timestamptz, text, timestamptz, text), public.platform_courtesy(uuid, text, timestamptz, text, timestamptz, text),
  public.platform_set_plan(uuid, text, text, text, timestamptz), public.platform_set_status(uuid, text, text, timestamptz), public.platform_override(uuid, int, timestamptz, text),
  public.platform_orgs(), public.platform_metrics(int), public.platform_org_timeline(uuid), public.saas_expire_access() from public, anon;
grant execute on function public.platform_trial(uuid, text, int, timestamptz, text, timestamptz, text), public.platform_courtesy(uuid, text, timestamptz, text, timestamptz, text),
  public.platform_set_plan(uuid, text, text, text, timestamptz), public.platform_set_status(uuid, text, text, timestamptz), public.platform_override(uuid, int, timestamptz, text),
  public.platform_orgs(), public.platform_metrics(int), public.platform_org_timeline(uuid) to authenticated;
revoke execute on function public.saas_expire_access() from authenticated;
grant execute on function public.saas_expire_access() to service_role;
