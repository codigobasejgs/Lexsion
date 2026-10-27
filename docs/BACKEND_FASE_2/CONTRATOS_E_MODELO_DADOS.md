# Backend fase 2: contratos e modelo de dados (proposta, NÃO executada)

> Nada aqui foi criado no Supabase. É a especificação para a fase de backend, derivada dos tipos reais do frontend
> (`src/domain/types.ts`, `tenancy.ts`, `saas.ts`, `permissions.ts`, `services/adapters.ts`). SQL ilustrativo para revisão.
> Executar só com autorização explícita, em projeto novo/branch do Supabase, nunca direto em produção.

## 1. Princípios
1. **Isolamento por escritório (tenant)**: toda tabela de negócio tem `organization_id uuid not null` e RLS ligada. Nenhuma consulta confia em filtro do cliente.
2. **Plataforma separada do escritório**: `saas_*` (assinatura LexSion → escritório) nunca se mistura com `installments/payments` (honorários escritório → cliente final). Super Admin lê agregados; conteúdo de casos/documentos/conversas fica inacessível sem consentimento registrado.
3. **Segredos só no servidor**: chaves Resend, Evolution, gateways, ZapSign, R2 e `service_role` ficam em variáveis de ambiente do servidor (Vercel *Server*/Edge Functions). No navegador só `NEXT_PUBLIC_SUPABASE_URL` e a chave publicável.
4. **Idempotência**: webhooks gravam `provider_event_id` com `unique`; repetir o evento não altera estado (já modelado em `applyInvoiceEvent`, `applyChargeEvent`, `outbox`).
5. **Auditoria append-only**: `audit_events` sem `update/delete` para nenhum papel.
6. **Dinheiro em centavos** (`bigint`), datas civis em `date`, instantes em `timestamptz`.

## 2. Papéis (12) e mapeamento
| Papel no app (`Role`) | Escopo | Claim/tabela |
|---|---|---|
| `superadmin`, `platform_admin`, `platform_support` | Plataforma | `platform_members(user_id, role)` |
| `admin` (titular), `tenant_admin`, `advogado`, `controladoria`, `financeiro`, `atendimento`, `estagiario`, `external_collaborator` | Escritório | `memberships(user_id, organization_id, role)` |
| `cliente` | Portal | `client_portal_access(user_id, organization_id, client_id)` |

Matriz área × papel e ação × papel: `src/domain/permissions.ts` (`ACCESS`, `ACTIONS`). No backend, cada ação sensível vira checagem em função SQL (`security definer`) ou rota de servidor, além da RLS.

## 3. Tabelas (núcleo)
```sql
-- Plataforma
create table organizations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9](-?[a-z0-9])*$'),
  name text not null,
  status text not null check (status in ('ativa','trial','suspensa','inadimplente','cancelada','removida')),
  plan text not null references plans(id),
  cycle text not null check (cycle in ('mensal','trimestral','anual')),
  trial_ends_at timestamptz, suspended_at timestamptz, suspension_reason text,
  branding jsonb not null default '{}'::jsonb,       -- TenantBranding (sem data: URI; logos vão ao Storage)
  branding_version int not null default 1,
  created_at timestamptz not null default now()
);
create table plans (id text primary key, label text not null, prices jsonb not null, quotas jsonb not null, trial_days int not null, modules text[] not null, white_label bool not null, custom_domain bool not null);
create table platform_members (user_id uuid primary key references auth.users, role text not null check (role in ('superadmin','platform_admin','platform_support')));
create table memberships (user_id uuid references auth.users, organization_id uuid references organizations on delete cascade, role text not null, primary key (user_id, organization_id));
create table client_portal_access (user_id uuid references auth.users, organization_id uuid references organizations, client_id uuid not null, primary key (user_id, client_id));

create table saas_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations,
  plan text not null, cycle text not null, period_start date not null, period_end date not null, due date not null,
  amount_cents bigint not null check (amount_cents >= 0),
  status text not null check (status in ('pendente','paga','vencida','falhou','reembolsada','estornada','disputada','cancelada')),
  provider text, paid_at timestamptz, history jsonb not null default '[]'
);
create table saas_invoice_events (provider text not null, provider_event_id text not null, invoice_id uuid not null references saas_invoices, type text not null, received_at timestamptz not null default now(), primary key (provider, provider_event_id));

-- Escritório (todas com organization_id + RLS)
create table clients (id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations, kind text not null check (kind in ('PF','PJ')), name text not null, document text not null, birth_date date, phone text, email text, city text, uf char(2), owner_id uuid, origin text, status text not null default 'ativo', lead_id uuid, created_at timestamptz not null default now(), unique (organization_id, document));
create table cases (id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations, client_id uuid not null references clients, title text not null, area text not null, kind text not null, phase text not null, owner_id uuid not null, confidential bool not null default false, portal_status text, portal_next_step text);
create table portal_updates (id uuid primary key default gen_random_uuid(), organization_id uuid not null, case_id uuid not null references cases, text text not null, status text not null check (status in ('rascunho','publicada')), published_by uuid, published_at timestamptz);
create table installments (id uuid primary key default gen_random_uuid(), organization_id uuid not null, contract_id uuid not null, client_id uuid not null, label text not null, amount_cents bigint not null, paid_cents bigint not null default 0, due date not null, status text not null);
create table payments (id uuid primary key default gen_random_uuid(), organization_id uuid not null, installment_id uuid not null references installments, amount_cents bigint not null, date date not null, method text not null, source text not null, reversal_of uuid references payments, idempotency_key text not null, unique (organization_id, idempotency_key));
create table tasks (id uuid primary key default gen_random_uuid(), organization_id uuid not null, title text not null, due date, status text not null, assignee_id uuid, case_id uuid, recurrence text, series_id text, anchor_day int, unique (organization_id, series_id, due));
create table files (id uuid primary key default gen_random_uuid(), organization_id uuid not null, bucket_key text not null, name text not null, mime text not null, size bigint not null, sha256 text not null, created_at timestamptz default now());
create table outbox (id uuid primary key default gen_random_uuid(), organization_id uuid not null, channel text not null, payload jsonb not null, status text not null, attempts int not null default 0, idempotency_key text not null, unique (organization_id, idempotency_key));
create table audit_events (id bigint generated always as identity primary key, organization_id uuid, at timestamptz not null default now(), actor_id uuid, action text not null, entity text not null, entity_id text not null, detail text);
```
Demais coleções do mock (`leads`, `conversations`, `messages`, `deadlines`, `events`, `documents`, `contracts`, `proposals`, `charges`, `expenses`, `bank_lines`, `receipts`, `requisitions`, `calculations`, `templates`, `drafts`, `agents`, `automations`, `campaigns`, `landing_pages`, `notifications`, `settings`, `learning`, `import_batches`, `support_tickets`) seguem o mesmo padrão: colunas = campos do tipo TypeScript, `organization_id` obrigatório, RLS igual à seção 4.

## 4. RLS (padrão)
```sql
create function is_member(org uuid) returns bool language sql stable security definer set search_path = public as
  $$ select exists (select 1 from memberships m where m.user_id = auth.uid() and m.organization_id = org) $$;
create function has_role(org uuid, roles text[]) returns bool language sql stable security definer set search_path = public as
  $$ select exists (select 1 from memberships m where m.user_id = auth.uid() and m.organization_id = org and m.role = any(roles)) $$;

alter table clients enable row level security;
create policy clients_rw on clients for all using (is_member(organization_id)) with check (is_member(organization_id));

-- honorários: só papéis com "ver_honorarios"
alter table installments enable row level security;
create policy inst_read on installments for select using (has_role(organization_id, array['admin','tenant_admin','advogado','financeiro']));

-- casos sigilosos: só quem tem "ver_casos_sigilosos" ou é responsável
create policy cases_read on cases for select using (is_member(organization_id) and (not confidential or owner_id = auth.uid() or has_role(organization_id, array['admin','advogado'])));

-- correspondente externo: só registros atribuídos (case_assignments)
-- portal: cliente lê só o próprio cliente e atualizações PUBLICADAS
create policy portal_updates_client on portal_updates for select using (
  status = 'publicada' and exists (select 1 from client_portal_access p join cases c on c.client_id = p.client_id where p.user_id = auth.uid() and c.id = case_id));

-- auditoria: insere, nunca altera
alter table audit_events enable row level security;
create policy audit_insert on audit_events for insert with check (organization_id is null or is_member(organization_id));
create policy audit_read on audit_events for select using (has_role(organization_id, array['admin']));
-- sem policy de update/delete = negado
```
Plataforma: `saas_*` e `organizations` com policies para `platform_members`; o escritório lê **só leitura** a própria assinatura (`/app/configuracoes?aba=assinatura`, papel `admin`).

## 5. Storage (R2 ou Supabase Storage)
- Bucket privado por ambiente; chave `org/<organization_id>/<file_id>`; upload por URL assinada de curta duração gerada no servidor (`ObjectStorageAdapter.signedUploadUrl`).
- Logos de tenant: validar *magic bytes*, recusar SVG, reencodar PNG (mesma regra de `src/lib/logo-upload.ts`).
- Antivírus/limite de tamanho no servidor; `sha256` gravado.

## 6. Contratos dos adaptadores (já tipados em `src/services/adapters.ts`)
| Adaptador | Métodos | Implementação real (fase 2) |
|---|---|---|
| `PaymentProviderAdapter` (Asaas, InfinitePay, Mercado Pago) | `createCheckout`, `getCharge`, `refund`, `parseWebhook`, `status` | Route Handler `/api/webhooks/<provider>` com verificação de assinatura → `saas_invoice_events`/`charges` idempotente |
| `MessagingAdapter` (Evolution) | `send` (exige consentimento) | worker lendo `outbox`; webhook `messages.upsert`/`connection.update` |
| `EmailAdapter` (Resend) | `send` | servidor; modelos de `src/domain/email-templates.ts` (HTML já escapado) |
| `SignatureAdapter` (ZapSign) | `createEnvelope` | webhook por signatário |
| `LegalDataAdapter` | `search` (por CNJ) | só fontes públicas/autorizadas; sem autos sigilosos |
| `ObjectStorageAdapter` | `signedUploadUrl` | R2/Supabase Storage |
| `AIProviderAdapter` | `suggest` | provedor a definir; `requiresHumanReview: true` sempre |
| Auth (`authRepository`, `src/services/auth.ts`) | `status`, `signIn`, `requestPasswordReset`, `signOut` | Supabase Auth + MFA; `/entrar` e `/recuperar-acesso` já chamam a interface |

Todos devolvem `{ ok, data | error, correlationId }`; estado `IntegrationStatus` muda para `active` só após teste em sandbox aprovado.

## 7. Migração dos dados da demo
Não migrar dados fictícios para produção. Script de *seed* separado para ambiente de homologação usando `src/mocks/*`.

## 8. Sequência sugerida
1. Projeto Supabase de homologação + Auth (e-mail/senha + MFA) + `organizations/memberships/platform_members`.
2. RLS núcleo (clientes, casos, portal) com testes SQL (pgTAP) por papel, incluindo tentativa cruzada entre tenants.
3. Troca gradual de `services/mock/*` por repositórios Supabase atrás das mesmas interfaces (o app já consome via `repo`/`tenantRepo`).
4. Storage, outbox + Evolution, Resend, gateway escolhido, ZapSign.
5. CSP com nonce, limites de taxa e observabilidade (logs sem dados pessoais).
