# 11 — Backend futuro: contratos

Base: `docs/BACKEND_FASE_2/CONTRATOS_E_MODELO_DADOS.md` (tabelas, RLS, Storage, adaptadores). Aqui ficam só os **acréscimos** desta execução. Nada foi executado.

## Tabelas novas propostas
```sql
create table assessments (id uuid primary key, organization_id uuid not null references organizations, case_id uuid not null references cases, client_id uuid not null,
  kind text not null check (kind in ('bpc','ppp')), title text not null, status text not null, data jsonb not null, inputs_version int not null,
  reviewed_version int, reviewer_id uuid, history jsonb not null default '[]');
create table legal_sources (id uuid primary key, organization_id uuid not null references organizations, kind text not null, label text not null, organ text not null,
  url text check (url ~ '^https://[^/]+\.(gov|jus|leg|mp)\.br'), excerpt text, checked_at timestamptz, checked_by uuid,
  status text not null check (status in ('VERIFICADO','NAO_VERIFICADO','DESATUALIZADO','NAO_DISPONIVEL')), case_id uuid);
create table draft_versions (draft_id uuid references drafts on delete cascade, n int not null, at timestamptz not null, actor_id uuid, body text not null, primary key (draft_id, n));
alter table leads add column opt_out_at timestamptz;
create table lead_follow_ups (lead_id uuid references leads, at timestamptz not null, sent boolean not null, note text not null);
create table calculation_runs (calculation_id uuid references calculations, inputs_version int, model text, status text, result jsonb, memory jsonb, assumptions jsonb, index_source text, base_date date);
```
RLS: mesmo padrão `is_member(organization_id)`. Revisar análise ou aprovar minuta exige `has_role(..., array['admin','advogado'])` **no servidor**. A verificação de citação é refeita no servidor (`checkCitations`) antes de aprovar.

## Endpoints (Route Handlers, servidor)
| Endpoint | Faz | Segurança |
|---|---|---|
| `POST /api/drafts/:id/approve` | recalcula citações e campos; aprova | papel + RLS; idempotente por hash |
| `POST /api/indices/series` | consulta índice no provedor contratado | `CJ_API_KEY` só no servidor; cache por (índice, mês); limite de taxa |
| `POST /api/leads/:id/follow-up` | decide com `canFollowUp` e enfileira no outbox | opt-out e janela checados no servidor; Evolution só com consentimento |
| `POST /api/cases/:id/workflows/:tpl` | aplica o modelo | ids determinísticos; feriados do tenant |
| `POST /api/contracts/:id/cancel` | cancela o envelope no provedor | webhook idempotente |
| `GET /api/datajud/:cnj` | metadados públicos | só após análise dos termos de uso comercial |

## Homologação, em ordem
1. Fonte oficial de índices com data-base e vetores comparados à fonte.
2. Revisão jurídica de carência, qualidade de segurado e critérios do BPC (fração, exclusões) por profissional habilitado.
3. Parser de CNIS em PDF no servidor, com comparação manual em casos sintéticos.
4. Integrações (ZapSign, gateway, Evolution) em sandbox, com webhooks assinados.
