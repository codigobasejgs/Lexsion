-- Contrato SaaS AUTOMÁTICO (decisão do proprietário, 03/11/2026): sem aprovação jurídica/fiscal/comercial manual
-- como etapa obrigatória. Um modelo salvo sem “[PENDENTE” fica disponível sozinho (versão nova PUBLICADA, a anterior
-- ARQUIVADA, na mesma transação). As condições da plataforma que o texto usa ficam em saas_supplier_profile.conditions;
-- enquanto faltar alguma, o texto renderizado tem “[PENDENTE: …]” e o aceite não abre (diagnóstico exato no Super Admin).
-- ADITIVA: nada é apagado. Aprovações históricas (approved_by_*) e o checklist antigo ficam como registro.
-- Reversão: reaplicar o saas_ctv_guard de 20261030170000 e dropar as funções/colunas novas.

-- 1) Condições da plataforma (preenchidas uma vez pelo Super Admin; entram no snapshot de cada contrato).
alter table public.saas_supplier_profile add column if not exists conditions jsonb not null default '{}'::jsonb;

-- 2) Tentativa de contratação: marcador de provisionamento (evita dois pedidos/testes em aceites concorrentes) e
--    estado "substituído" para duplicatas antigas não aceitas (reconciliação).
alter table public.saas_contracts add column if not exists provisioning_at timestamptz;
alter table public.saas_contracts add column if not exists superseded_by uuid references public.saas_contracts(id) on delete set null;
alter table public.saas_contracts drop constraint if exists saas_contracts_status_check;
alter table public.saas_contracts add constraint saas_contracts_status_check check (status in ('DRAFT','READY_FOR_REVIEW','TERMS_ACCEPTED','SIGNATURE_PENDING','SIGNED_BY_CUSTOMER','PAYMENT_PENDING','PAYMENT_CONFIRMED','ACTIVE','CANCELED','EXPIRED','FAILED','SUPERSEDED'));

-- 3) Guarda do modelo sem exigência de nome/OAB: versão publicada continua imutável e sem “[PENDENTE”.
create or replace function public.saas_ctv_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'RASCUNHO' then raise exception 'só rascunho pode ser excluído' using errcode = '42501'; end if;
    return old;
  end if;
  if old.status in ('APROVADO','PUBLICADO','ARQUIVADO') and (new.clauses is distinct from old.clauses or new.content_sha256 <> old.content_sha256 or new.version <> old.version or new.title <> old.title) then
    raise exception 'versão publicada é imutável; crie nova versão' using errcode = '42501';
  end if;
  if new.status <> old.status and not (
       (old.status in ('RASCUNHO','REVISAO_JURIDICA') and new.status in ('PUBLICADO','ARQUIVADO','RASCUNHO','REVISAO_JURIDICA'))
    or (old.status = 'APROVADO' and new.status in ('PUBLICADO','ARQUIVADO'))
    or (old.status = 'PUBLICADO' and new.status = 'ARQUIVADO')) then
    raise exception 'transição de % para % não permitida', old.status, new.status using errcode = '23514';
  end if;
  if new.status in ('APROVADO','PUBLICADO') and new.clauses::text ~ '\[PENDENTE' then
    raise exception 'o texto ainda tem itens [PENDENTE]; resolva todos antes de disponibilizar' using errcode = '23514';
  end if;
  return new;
end $$;

-- 4) Salvar modelo completo = disponibilizar (uma transação: arquiva a vigente e publica a nova). Só o servidor.
create or replace function public.saas_publish_template(p_key text, p_version text, p_title text, p_clauses jsonb, p_hash text, p_reason text, p_actor uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if p_clauses::text ~ '\[PENDENTE' then raise exception 'o texto ainda tem itens [PENDENTE]' using errcode = '23514'; end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'informe o motivo da versão (mínimo 5 caracteres)' using errcode = '23514'; end if;
  perform 1 from public.saas_contract_template_versions where template_key = p_key and status = 'PUBLICADO' for update;
  update public.saas_contract_template_versions set status = 'ARQUIVADO' where template_key = p_key and status = 'PUBLICADO';
  insert into public.saas_contract_template_versions (template_key, version, title, status, clauses, content_sha256, change_reason, created_by, published_at, effective_from)
    values (p_key, p_version, p_title, 'PUBLICADO', p_clauses, p_hash, trim(p_reason), p_actor, now(), current_date) returning id into v;
  insert into public.saas_contract_audit (template_version_id, actor_id, action, detail)
    values (v, p_actor, 'modelo.disponibilizado', p_version || ': versão completa salva e disponibilizada automaticamente; ' || left(trim(p_reason), 200));
  return v;
end $$;
revoke execute on function public.saas_publish_template(text, text, text, jsonb, text, text, uuid) from public, anon, authenticated;
grant execute on function public.saas_publish_template(text, text, text, jsonb, text, text, uuid) to service_role;

-- 5) Namespace de TESTE (só quando o servidor de teste define SAAS_CONFIG_NS=qa): perfil "qa" e modelo
--    "saas-lexsion-qa". Produção nunca usa. Aceites/arquivos de contratos QA podem ser removidos pelo servidor
--    (limpeza dos testes); os de produção continuam só-acréscimo.
alter table public.saas_supplier_profile drop constraint if exists saas_supplier_profile_id_check;
alter table public.saas_supplier_profile add constraint saas_supplier_profile_id_check check (id in ('vigente','qa'));
create or replace function public.saas_contract_evidence_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' and auth.uid() is null and exists (
       select 1 from public.saas_contracts c join public.saas_contract_template_versions t on t.id = c.template_version_id
       where c.id = old.contract_id and t.template_key = 'saas-lexsion-qa') then
    return old;
  end if;
  raise exception 'registro só-acréscimo: % não é permitido', tg_op using errcode = '42501';
end $$;
revoke execute on function public.saas_contract_evidence_guard() from public, anon, authenticated;
drop trigger if exists saas_acceptances_append_only on public.saas_contract_acceptances;
create trigger saas_acceptances_append_only before update or delete on public.saas_contract_acceptances for each row execute function public.saas_contract_evidence_guard();
drop trigger if exists saas_files_append_only on public.saas_contract_files;
create trigger saas_files_append_only before update or delete on public.saas_contract_files for each row execute function public.saas_contract_evidence_guard();
-- Auditoria contratual de contratos QA também pode ser limpa pelo servidor (produção continua só-acréscimo).
create or replace function public.saas_contract_audit_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' and auth.uid() is null and (
       exists (select 1 from public.saas_contracts c join public.saas_contract_template_versions t on t.id = c.template_version_id where c.id = old.contract_id and t.template_key = 'saas-lexsion-qa')
    or exists (select 1 from public.saas_contract_template_versions t where t.id = old.template_version_id and t.template_key = 'saas-lexsion-qa')) then
    return old;
  end if;
  raise exception 'registro só-acréscimo: % não é permitido', tg_op using errcode = '42501';
end $$;
revoke execute on function public.saas_contract_audit_guard() from public, anon, authenticated;
drop trigger if exists saas_contract_audit_append_only on public.saas_contract_audit;
create trigger saas_contract_audit_append_only before update or delete on public.saas_contract_audit for each row execute function public.saas_contract_audit_guard();

-- 6) Reconciliação dos contratos presos (prévia por padrão; aplicar só com p_apply = true). Nunca toca contrato
--    aceito, com pedido ou com escritório. Classifica:
--      expirado          → prévia não aceita com prazo vencido (7 dias)       ⇒ EXPIRED
--      substituido       → prévia não aceita do MESMO titular (e-mail + documento) e MESMO plano/ciclo, mais antiga
--                          que outra vigente dele                              ⇒ SUPERSEDED (superseded_by = a mais nova)
--      em_andamento      → prévia não aceita vigente (fica como está; segue pelo novo fluxo)
--      aceito/vinculado  → nada muda
create or replace function public.saas_reconcile_contracts(p_apply boolean default false) returns table (contrato text, criado_em timestamptz, classe text, acao text, canonico text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  return query
  with base as (
    select c.id, c.number, c.created_at, c.status, c.accepted_at, c.order_id, c.organization_id, c.expires_at, c.plan_id, c.cycle,
      lower(coalesce(case when c.party->>'kind' = 'PJ' then c.party->'rep'->>'email' else c.party->>'email' end, '')) || '|' ||
      regexp_replace(coalesce(case when c.party->>'kind' = 'PJ' then c.party->>'cnpj' else c.party->>'cpf' end, ''), '\D', '', 'g') holder
    from public.saas_contracts c),
  cls as (
    select b.*, (select n.id from base n where n.holder = b.holder and n.plan_id = b.plan_id and n.cycle = b.cycle and n.accepted_at is null and n.order_id is null
                   and n.status = 'READY_FOR_REVIEW' and n.created_at > b.created_at order by n.created_at desc limit 1) newer
    from base b),
  plan as (
    select c.*, case
      when c.accepted_at is not null or c.order_id is not null or c.organization_id is not null then 'aceito_ou_vinculado'
      when c.status <> 'READY_FOR_REVIEW' then 'ja_tratado'
      when c.newer is not null then 'substituido'
      when c.expires_at < now() then 'expirado'
      else 'em_andamento' end classe
    from cls c),
  upd as (
    update public.saas_contracts s set status = case p.classe when 'substituido' then 'SUPERSEDED' else 'EXPIRED' end,
      superseded_by = case when p.classe = 'substituido' then p.newer end, updated_at = now()
    from plan p where p_apply and s.id = p.id and p.classe in ('substituido','expirado') and s.accepted_at is null and s.status = 'READY_FOR_REVIEW'
    returning s.id)
  , aud as (insert into public.saas_contract_audit (contract_id, action, detail)
      select p.id, 'reconciliacao.' || p.classe, case when p.classe = 'substituido' then 'prévia não aceita substituída por ' || (select x.number from public.saas_contracts x where x.id = p.newer) else 'prévia não aceita expirada (7 dias)' end
      from plan p where p.id in (select id from upd) returning 1)
  select p.number, p.created_at, p.classe,
    case when p.classe in ('substituido','expirado') then (case when p_apply then 'aplicado' else 'a aplicar' end) || ': ' || case p.classe when 'substituido' then 'SUPERSEDED' else 'EXPIRED' end else 'nenhuma' end,
    (select n.number from base n where n.id = p.newer)
  from plan p order by p.created_at;
end $$;
revoke execute on function public.saas_reconcile_contracts(boolean) from public, anon, authenticated;
grant execute on function public.saas_reconcile_contracts(boolean) to service_role;
