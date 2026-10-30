-- Contrato SaaS LexSion (contratada ⇄ escritório). ADITIVA: só cria tabelas, funções, bucket e índices; nenhum
-- dado existente é alterado. Universo SEPARADO dos contratos que os escritórios firmam com os próprios clientes
-- (org_records "contracts"). Reversão: drop das tabelas saas_contract_* / saas_supplier_profile e do bucket.
-- Regras:
--  * modelos versionados com fluxo RASCUNHO → REVISAO_JURIDICA → APROVADO → PUBLICADO → ARQUIVADO; versão aprovada é
--    IMUTÁVEL (trigger). Aceite vinculante só com versão PUBLICADA (= aprovada por advogado e publicada);
--  * contrato gerado a partir de SNAPSHOTS (fornecedora, contratante, plano, versão) com hash SHA-256 do texto;
--  * aceite é evento append-only, com OTP de uso único e evidências mínimas; nada disso é "assinatura" de provedor;
--  * escrita só pelo servidor (service_role). Titular lê só os do próprio escritório; plataforma (MFA) lê tudo.

-- Dados da CONTRATADA (fonte: comprovante de CNPJ enviado pelo proprietário em 30/10/2026). Uma linha "vigente";
-- cada contrato guarda o snapshot do momento. Contato contratual é configurável (não presumir canal de suporte).
create table if not exists public.saas_supplier_profile (
  id text primary key default 'vigente' check (id = 'vigente'),
  trade_name text not null,
  legal_name text not null,
  document text not null,
  legal_nature text not null,
  size text,
  address jsonb not null,
  contact_email text,
  contact_phone text,
  verified_at timestamptz,                 -- conferência cadastral (Super Admin, com evidência)
  verified_note text,
  checklist jsonb not null default '{}'::jsonb, -- aprovação comercial/fiscal/jurídica (itens marcados com autor e data)
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.saas_supplier_profile (trade_name, legal_name, document, legal_nature, size, address, contact_email, contact_phone)
values ('LexSion — ERP Jurídico SaaS', '59.760.458 MARCO ANTONIO BOGGIAN', '59.760.458/0001-91', 'Empresário individual (213-5)', 'ME',
        '{"street":"Rua Jacques Pilon","number":"189","district":"Vila Piauí","city":"São Paulo","uf":"SP","cep":"05109-160"}', null, null)
on conflict (id) do nothing;

create table if not exists public.saas_contract_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_key text not null default 'saas-lexsion',
  version text not null,
  title text not null,
  language text not null default 'pt-BR',
  status text not null default 'RASCUNHO' check (status in ('RASCUNHO','REVISAO_JURIDICA','APROVADO','PUBLICADO','ARQUIVADO')),
  clauses jsonb not null,                  -- [{ "n": "1", "title": "...", "body": "... {{campo}} ..." }]
  content_sha256 text not null,
  change_reason text,
  approved_by_name text,                   -- advogado(a) responsável (nome + OAB) — só humano preenche
  approved_by_user uuid,
  approved_at timestamptz,
  published_at timestamptz,
  effective_from date,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (template_key, version)
);
create unique index if not exists saas_ctv_one_published on public.saas_contract_template_versions (template_key) where status = 'PUBLICADO';

-- Versão aprovada/publicada/arquivada é imutável no conteúdo; transições só para frente.
create or replace function public.saas_ctv_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'RASCUNHO' then raise exception 'só rascunho pode ser excluído' using errcode = '42501'; end if;
    return old;
  end if;
  if old.status in ('APROVADO','PUBLICADO','ARQUIVADO') and (new.clauses is distinct from old.clauses or new.content_sha256 <> old.content_sha256 or new.version <> old.version or new.title <> old.title) then
    raise exception 'versão aprovada é imutável; crie nova versão' using errcode = '42501';
  end if;
  if new.status <> old.status and not (
       (old.status = 'RASCUNHO' and new.status in ('REVISAO_JURIDICA','ARQUIVADO'))
    or (old.status = 'REVISAO_JURIDICA' and new.status in ('RASCUNHO','APROVADO','ARQUIVADO'))
    or (old.status = 'APROVADO' and new.status in ('PUBLICADO','ARQUIVADO'))
    or (old.status = 'PUBLICADO' and new.status = 'ARQUIVADO')) then
    raise exception 'transição de % para % não permitida', old.status, new.status using errcode = '23514';
  end if;
  if new.status in ('APROVADO','PUBLICADO') and (new.approved_by_name is null or length(trim(new.approved_by_name)) < 5 or new.approved_at is null) then
    raise exception 'aprovação exige o nome/OAB do(a) advogado(a) responsável' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists saas_ctv_guard on public.saas_contract_template_versions;
create trigger saas_ctv_guard before update or delete on public.saas_contract_template_versions for each row execute function public.saas_ctv_guard();

create table if not exists public.saas_contracts (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,             -- público, não previsível (LX-AAAA-XXXXXXXX)
  session_token_sha256 text not null unique, -- token opaco da jornada (só o hash fica no banco)
  status text not null default 'DRAFT' check (status in ('DRAFT','READY_FOR_REVIEW','TERMS_ACCEPTED','SIGNATURE_PENDING','SIGNED_BY_CUSTOMER','PAYMENT_PENDING','PAYMENT_CONFIRMED','ACTIVE','CANCELED','EXPIRED','FAILED')),
  template_version_id uuid not null references public.saas_contract_template_versions(id),
  template_status_at_render text not null, -- PUBLICADO ⇒ vinculante; outro ⇒ minuta (sem aceite)
  plan_id text not null references public.saas_plans(id),
  cycle text not null check (cycle in ('mensal','anual')),
  amount int not null check (amount >= 100),
  plan_snapshot jsonb not null,
  supplier_snapshot jsonb not null,
  party jsonb not null,                    -- contratante (PF/PJ) + representante + endereço (dados mínimos)
  body_text text,                          -- texto final renderizado (o que foi lido)
  document_sha256 text,
  marketing_opt_in boolean not null default false,
  order_id uuid references public.saas_orders(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists saas_contracts_org on public.saas_contracts (organization_id);

create table if not exists public.saas_contract_acceptances (
  id bigint generated always as identity primary key,
  contract_id uuid not null references public.saas_contracts(id) on delete restrict,
  document_sha256 text not null,
  template_version_id uuid not null,
  accepted_at timestamptz not null default now(),
  method text not null default 'clickwrap_otp_email',
  email text not null,
  signer_name text not null,
  signer_document_last4 text,              -- minimização: só os 4 últimos dígitos
  ip_hash text,                            -- HMAC do IP (não o IP)
  user_agent text,
  otp_id uuid not null,
  unique (contract_id)                     -- um aceite por contrato (refresh/duplo clique não duplica)
);
-- Append-only: ninguém altera nem apaga um aceite.
create or replace function public.saas_append_only() returns trigger language plpgsql as $$
begin raise exception 'registro só-acréscimo: % não é permitido', tg_op using errcode = '42501'; end $$;
drop trigger if exists saas_acceptances_append_only on public.saas_contract_acceptances;
create trigger saas_acceptances_append_only before update or delete on public.saas_contract_acceptances for each row execute function public.saas_append_only();

create table if not exists public.saas_contract_otps (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.saas_contracts(id) on delete cascade,
  email text not null,
  code_hash text not null,                 -- HMAC(código) — o código nunca é gravado
  document_sha256 text not null,           -- OTP vale só para ESTA versão do documento
  attempts int not null default 0,
  used_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists saas_otps_contract on public.saas_contract_otps (contract_id, created_at desc);

create table if not exists public.saas_contract_files (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.saas_contracts(id) on delete restrict,
  kind text not null check (kind in ('contrato_aceito','comprovante_aceite')),
  storage_path text not null unique,
  sha256 text not null,
  bytes int not null,
  created_at timestamptz not null default now(),
  unique (contract_id, kind)
);
drop trigger if exists saas_files_append_only on public.saas_contract_files;
create trigger saas_files_append_only before update or delete on public.saas_contract_files for each row execute function public.saas_append_only();

create table if not exists public.saas_contract_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  contract_id uuid,
  template_version_id uuid,
  actor_id uuid,
  action text not null,
  detail text
);
drop trigger if exists saas_contract_audit_append_only on public.saas_contract_audit;
create trigger saas_contract_audit_append_only before update or delete on public.saas_contract_audit for each row execute function public.saas_append_only();

-- Pedido nasce de um contrato aceito (vínculo para a prova).
alter table public.saas_orders add column if not exists contract_id uuid references public.saas_contracts(id) on delete set null;

alter table public.saas_supplier_profile enable row level security;
alter table public.saas_contract_template_versions enable row level security;
alter table public.saas_contracts enable row level security;
alter table public.saas_contract_acceptances enable row level security;
alter table public.saas_contract_otps enable row level security;
alter table public.saas_contract_files enable row level security;
alter table public.saas_contract_audit enable row level security;

drop policy if exists sup_read on public.saas_supplier_profile;
create policy sup_read on public.saas_supplier_profile for select to authenticated using (public.is_platform(array['superadmin','platform_admin']));
drop policy if exists ctv_read on public.saas_contract_template_versions;
create policy ctv_read on public.saas_contract_template_versions for select to authenticated using (public.is_platform(array['superadmin','platform_admin']));
drop policy if exists contracts_read on public.saas_contracts;
create policy contracts_read on public.saas_contracts for select to authenticated
  using (public.is_platform(array['superadmin','platform_admin']) or (organization_id is not null and public.is_org_owner(organization_id)));
drop policy if exists acc_read on public.saas_contract_acceptances;
create policy acc_read on public.saas_contract_acceptances for select to authenticated
  using (exists (select 1 from public.saas_contracts c where c.id = contract_id and (public.is_platform(array['superadmin','platform_admin']) or (c.organization_id is not null and public.is_org_owner(c.organization_id)))));
drop policy if exists files_read on public.saas_contract_files;
create policy files_read on public.saas_contract_files for select to authenticated
  using (exists (select 1 from public.saas_contracts c where c.id = contract_id and (public.is_platform(array['superadmin','platform_admin']) or (c.organization_id is not null and public.is_org_owner(c.organization_id)))));
drop policy if exists caudit_read on public.saas_contract_audit;
create policy caudit_read on public.saas_contract_audit for select to authenticated using (public.is_platform(array['superadmin','platform_admin']));
-- saas_contract_otps: nenhuma política ⇒ ninguém do navegador lê.

revoke all on public.saas_supplier_profile, public.saas_contract_template_versions, public.saas_contracts, public.saas_contract_acceptances,
  public.saas_contract_otps, public.saas_contract_files, public.saas_contract_audit from anon, authenticated;
grant select on public.saas_supplier_profile, public.saas_contract_template_versions, public.saas_contracts, public.saas_contract_acceptances,
  public.saas_contract_files, public.saas_contract_audit to authenticated;
revoke execute on function public.saas_ctv_guard(), public.saas_append_only() from public, anon, authenticated;

-- Arquivos contratuais: bucket PRIVADO separado dos documentos dos escritórios; acesso só por URL assinada do servidor.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contratos-saas', 'contratos-saas', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;
