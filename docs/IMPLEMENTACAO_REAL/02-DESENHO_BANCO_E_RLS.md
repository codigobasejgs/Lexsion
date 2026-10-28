# 02 — Banco e RLS (aplicado no Supabase)

Migrations em `supabase/migrations/` (3 arquivos), aplicadas em 28/10/2026 no projeto `lexsion`. Registro em `supabase_migrations.schema_migrations`.

## Tabelas (12, todas com RLS ligada)
`organizations` · `platform_members` · `profiles` · `organization_memberships` · `clients` · `client_portal_access` · `cases` · `portal_updates` · `tasks` · `documents` · `drafts` · `audit_logs`
Storage: bucket **privado** `documentos` (15 MB; PDF/JPEG/PNG/WebP; SVG recusado), caminho `<organization_id>/…`.

## Princípios
- `auth.uid()` (JWT validado pelo Supabase) é a única identidade; o `organization_id` enviado pelo navegador nunca autoriza nada — a política confere o vínculo em `organization_memberships`.
- Funções `is_member`, `has_role`, `is_platform`, `org_active` são `security definer` com `search_path` fixo.
- Escritório `suspensa/inadimplente/cancelada` perde acesso de equipe e portal; dados preservados.
- Operações sensíveis não são UPDATE livre: `approve_draft` (papel + versão otimista + campos preenchidos), `publish_portal_update` (papel, idempotente), `create_organization` e `set_organization_status` (só plataforma, motivo obrigatório).
- Auditoria por trigger, append-only (sem policy de update/delete; sem FK para sobreviver à exclusão do escritório).
- Exclusões: escritório apaga dados em cascata; usuário apagado zera autoria (`set null`).
- Privilégios: `anon` sem acesso a tabelas; `authenticated` só o necessário; `organizations` só colunas `name/branding`.

## Matriz de papéis (exemplos testados)
| Ação | Titular | Gestor | Advogado | Estagiário | Financeiro | Correspondente | Cliente | Outro escritório |
|---|---|---|---|---|---|---|---|---|
| Ler clientes | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | só o próprio | ❌ |
| Criar cliente | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Aprovar minuta | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Publicar no portal | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ler auditoria | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Mudar status/plano do escritório | ❌ (só plataforma) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

Provas: `tests/db/rls.test.ts` (19, PGlite, inclui **teste de mutação**: com RLS desligada em `clients`, 4 testes falham) e `tests/real/*.real.test.ts` (11, Supabase real).
