-- Super Admin gerencial (operação real). ADITIVA: amplia papéis da plataforma, colunas de auditoria e cria tabelas
-- de concessões/overrides e funções transacionais. Nenhum dado existente é alterado.
-- Regras:
--  * toda ação crítica é UMA função SQL (trava de linha + versão esperada + chave de idempotência) e grava auditoria
--    com antes/depois/motivo na MESMA transação;
--  * concessão (teste, cortesia, plano administrativo) NUNCA vira pagamento nem MRR; MRR vem só de saas_subscriptions
--    'ativa' (pagas pela InfinitePay e conferidas no payment_check);
--  * leitura gerencial por funções da plataforma (exigem MFA/aal2); suporte não vê valores; ninguém lê conteúdo jurídico.
-- Reversão: drop das funções platform_*/saas_expire_access e das tabelas saas_trial_grants/saas_entitlement_overrides.

-- 1) Papéis internos da LexSion (RBAC próprio) com validade opcional.
alter table public.platform_members drop constraint if exists platform_members_role_check;
alter table public.platform_members add constraint platform_members_role_check check (role in ('superadmin','platform_admin','platform_support','platform_finance','platform_auditor'));
alter table public.platform_members add column if not exists granted_by uuid;
alter table public.platform_members add column if not exists expires_at timestamptz;
alter table public.platform_members add column if not exists note text;

-- is_platform: mesmo contrato, agora com todos os papéis internos por padrão e respeito à validade do acesso.
create or replace function public.is_platform(roles text[] default array['superadmin','platform_admin','platform_support','platform_finance','platform_auditor']) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (select 1 from public.platform_members p where p.user_id = auth.uid() and p.role = any(roles) and (p.expires_at is null or p.expires_at > now()))
$$;
create or replace function public.platform_role() returns text
language sql stable security definer set search_path = public as $$
  select p.role from public.platform_members p
  where p.user_id = auth.uid() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2' and (p.expires_at is null or p.expires_at > now())
$$;
revoke execute on function public.platform_role() from public, anon;
grant execute on function public.platform_role() to authenticated;

-- 2) Auditoria com antes/depois e motivo (colunas novas; registros antigos ficam como estão).
alter table public.audit_logs add column if not exists reason text;
alter table public.audit_logs add column if not exists before jsonb;
alter table public.audit_logs add column if not exists after jsonb;
alter table public.audit_logs add column if not exists actor_role text;
drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select to authenticated
  using (public.has_role(organization_id, array['admin']) or public.is_platform(array['superadmin','platform_admin','platform_auditor']));

-- 3) Histórico de concessões (teste, prorrogação, cortesia): só-acréscimo; sai junto se o escritório for excluído.
create table if not exists public.saas_trial_grants (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('concessao','extensao','data_definida','reativacao','encerramento','cortesia','fim_cortesia','expiracao_automatica')),
  old_end timestamptz,
  new_end timestamptz,
  days int,
  reason text not null,
  actor_id uuid,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);
create index if not exists saas_grants_org on public.saas_trial_grants (organization_id, created_at desc);

-- Limites extras temporários (ex.: +2 usuários até 30/11) com motivo; revogáveis, nunca apagados.
create table if not exists public.saas_entitlement_overrides (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null check (key in ('max_users')),
  value int not null check (value between 1 and 1000),
  until timestamptz,
  reason text not null,
  actor_id uuid,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists saas_overrides_org on public.saas_entitlement_overrides (organization_id) where revoked_at is null;

create or replace function public.saas_history_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.organizations where id = old.organization_id) then return old; end if; -- cascata
  -- Única alteração aceita: revogar um limite extra (preenche revoked_at; o resto fica igual). Comparação por jsonb
  -- para não referenciar colunas que a outra tabela não tem.
  if tg_op = 'UPDATE' and tg_table_name = 'saas_entitlement_overrides' and (to_jsonb(old)->>'revoked_at') is null and (to_jsonb(new)->>'revoked_at') is not null
     and (to_jsonb(new) - 'revoked_at') = (to_jsonb(old) - 'revoked_at') then return new; end if;
  raise exception 'histórico só-acréscimo: % não é permitido', tg_op using errcode = '42501';
end $$;
drop trigger if exists saas_grants_guard on public.saas_trial_grants;
create trigger saas_grants_guard before update or delete on public.saas_trial_grants for each row execute function public.saas_history_guard();
drop trigger if exists saas_overrides_guard on public.saas_entitlement_overrides;
create trigger saas_overrides_guard before update or delete on public.saas_entitlement_overrides for each row execute function public.saas_history_guard();

alter table public.saas_trial_grants enable row level security;
alter table public.saas_entitlement_overrides enable row level security;
drop policy if exists grants_read on public.saas_trial_grants;
create policy grants_read on public.saas_trial_grants for select to authenticated using (public.is_platform());
drop policy if exists overrides_read on public.saas_entitlement_overrides;
create policy overrides_read on public.saas_entitlement_overrides for select to authenticated using (public.is_platform());
revoke all on public.saas_trial_grants, public.saas_entitlement_overrides from anon, authenticated;
grant select on public.saas_trial_grants, public.saas_entitlement_overrides to authenticated;

-- Financeiro SaaS e auditor leem pedidos/assinaturas; suporte não vê valores.
drop policy if exists saas_orders_read on public.saas_orders;
create policy saas_orders_read on public.saas_orders for select to authenticated
  using (public.is_platform(array['superadmin','platform_admin','platform_finance','platform_auditor']) or (organization_id is not null and public.is_org_owner(organization_id)));
drop policy if exists saas_subs_read on public.saas_subscriptions;
create policy saas_subs_read on public.saas_subscriptions for select to authenticated
  using (public.is_platform(array['superadmin','platform_admin','platform_finance','platform_auditor']) or public.is_org_owner(organization_id));

-- Limite de usuários: override ativo prevalece sobre o do plano contratado.
create or replace function public.memberships_quota() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim int; n int;
begin
  select coalesce(
    (select max(v.value) from public.saas_entitlement_overrides v where v.organization_id = new.organization_id and v.key = 'max_users' and v.revoked_at is null and (v.until is null or v.until > now())),
    (select s.max_users from public.saas_subscriptions s where s.organization_id = new.organization_id)) into lim;
  if lim is null then return new; end if;
  select count(*) into n from public.organization_memberships where organization_id = new.organization_id;
  if n >= lim then raise exception 'limite de % usuário(s) do plano atingido; peça a troca de plano', lim using errcode = '23514'; end if;
  return new;
end $$;
