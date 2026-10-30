-- Teste grátis (trial_days do plano, definido pelo Super Admin). ADITIVA: amplia os estados permitidos e
-- substitui duas funções; nenhum dado existente é alterado. Reversão: recriar as funções de 20261030120000.
--  * cadastro em plano com teste: o pedido nasce com status 'teste' (sem cobrança) e o escritório é criado em 'trial';
--  * um teste por CPF/CNPJ e por e-mail, garantido por índice único (não depende do app);
--  * fim do teste: a rotina de cobrança envia o link da 1ª mensalidade; pago, o escritório vira 'ativa'.
alter table public.saas_orders drop constraint if exists saas_orders_status_check;
alter table public.saas_orders add constraint saas_orders_status_check check (status in ('pendente','pago','estornado','cancelado','expirado','teste'));
alter table public.saas_subscriptions drop constraint if exists saas_subscriptions_status_check;
alter table public.saas_subscriptions add constraint saas_subscriptions_status_check check (status in ('teste','ativa','vencida','suspensa','cancelada'));
create unique index if not exists saas_orders_trial_document on public.saas_orders ((customer->>'document')) where status = 'teste';
create unique index if not exists saas_orders_trial_email on public.saas_orders ((lower(customer->>'email'))) where status = 'teste';

create or replace function public.saas_activate(p_order uuid, p_owner uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare o public.saas_orders; org uuid; inicio date; fim date; trial boolean;
begin
  select * into o from public.saas_orders where id = p_order for update;
  if o.id is null then raise exception 'pedido não encontrado' using errcode = 'P0002'; end if;
  if o.activation = 'concluida' then return o.organization_id; end if;
  if o.status not in ('pago','teste') or o.kind <> 'contratacao' then raise exception 'pedido não está pago' using errcode = '22023'; end if;
  trial := o.status = 'teste';
  inicio := (coalesce(o.paid_at, o.created_at) at time zone 'America/Sao_Paulo')::date;
  fim := case when trial then inicio + coalesce((o.plan_snapshot->>'trial_days')::int, 0)
              else (inicio + make_interval(months => case o.cycle when 'anual' then 12 else 1 end))::date end;
  if trial and fim <= inicio then raise exception 'plano sem teste grátis' using errcode = '22023'; end if;
  if exists (select 1 from public.organizations where slug = lower(o.customer->>'slug')) then raise exception 'endereço já em uso' using errcode = '23505'; end if;
  insert into public.organizations (slug, name, status, plan, branding, meta)
    values (lower(o.customer->>'slug'), o.customer->>'office', case when trial then 'trial' else 'ativa' end, o.plan_id,
            jsonb_build_object('brandName', o.customer->>'office', 'pwaShortName', left(o.customer->>'office', 12)),
            jsonb_build_object('ownerName', o.customer->>'name', 'ownerEmail', o.customer->>'email', 'document', o.customer->>'document', 'cycle', o.cycle, 'origem', 'contratacao', 'order', o.order_nsu,
                               'trialEndsAt', case when trial then fim end))
    returning id into org;
  insert into public.organization_memberships (organization_id, user_id, role) values (org, p_owner, 'admin');
  insert into public.saas_subscriptions (organization_id, plan_id, cycle, status, price, plan_snapshot, max_users, current_period_start, current_period_end)
    values (org, o.plan_id, o.cycle, case when trial then 'teste' else 'ativa' end, o.amount, o.plan_snapshot, (o.plan_snapshot->>'max_users')::int, inicio, fim);
  update public.saas_orders set organization_id = org, activation = 'concluida', activation_error = null, activation_attempts = activation_attempts + 1,
    period_start = inicio, period_end = fim,
    history = history || jsonb_build_array(jsonb_build_object('at', now(), 'text', case when trial then 'Escritório criado em teste grátis até ' || to_char(fim, 'DD/MM/YYYY') else 'Escritório ativado' end)),
    updated_at = now() where id = o.id;
  insert into public.audit_logs (organization_id, actor_id, action, entity, entity_id, detail)
    values (org, null, case when trial then 'assinatura.teste' else 'assinatura.ativada' end, 'saas_orders', o.order_nsu, o.plan_id || '/' || o.cycle || ' — ' || o.amount || ' centavos' || case when trial then ', teste até ' || fim else '' end);
  return org;
end $$;

-- Renovação paga: igual à anterior + fim do teste grátis pago vira escritório 'ativa'.
create or replace function public.saas_apply_renewal(p_order uuid) returns date
language plpgsql security definer set search_path = public as $$
declare o public.saas_orders; s public.saas_subscriptions; base date; fim date;
begin
  select * into o from public.saas_orders where id = p_order for update;
  if o.id is null then raise exception 'pedido não encontrado' using errcode = 'P0002'; end if;
  if o.activation = 'concluida' then return o.period_end; end if;
  if o.status <> 'pago' or o.kind <> 'renovacao' then raise exception 'renovação não está paga' using errcode = '22023'; end if;
  select * into s from public.saas_subscriptions where organization_id = o.organization_id for update;
  if s.organization_id is null then raise exception 'assinatura não encontrada' using errcode = 'P0002'; end if;
  base := greatest(s.current_period_end, (o.paid_at at time zone 'America/Sao_Paulo')::date);
  fim := (base + make_interval(months => case o.cycle when 'anual' then 12 else 1 end))::date;
  update public.saas_subscriptions set status = 'ativa', current_period_start = base, current_period_end = fim,
    plan_id = o.plan_id, cycle = o.cycle, price = o.amount,
    plan_snapshot = case when o.plan_snapshot = '{}'::jsonb then plan_snapshot else o.plan_snapshot end,
    max_users = coalesce((o.plan_snapshot->>'max_users')::int, max_users), change_request = null, updated_at = now() where organization_id = s.organization_id;
  update public.organizations set plan = o.plan_id, updated_at = now() where id = s.organization_id and plan is distinct from o.plan_id;
  update public.organizations set status = 'ativa', status_reason = null, updated_at = now()
    where id = s.organization_id and (status = 'trial' or (status = 'suspensa' and status_reason like 'Inadimplência%'));
  update public.saas_orders set activation = 'concluida', activation_attempts = activation_attempts + 1, period_start = base, period_end = fim,
    history = history || jsonb_build_array(jsonb_build_object('at', now(), 'text', 'Período renovado até ' || to_char(fim, 'DD/MM/YYYY'))), updated_at = now() where id = o.id;
  insert into public.audit_logs (organization_id, actor_id, action, entity, entity_id, detail)
    values (s.organization_id, null, 'assinatura.renovada', 'saas_orders', o.order_nsu, 'até ' || fim);
  return fim;
end $$;
revoke execute on function public.saas_activate(uuid, uuid), public.saas_apply_renewal(uuid) from public, anon, authenticated;
grant execute on function public.saas_activate(uuid, uuid), public.saas_apply_renewal(uuid) to service_role;
