# 03 — Migrations e rollback

| Versão | Arquivo | Aplicada | O que faz |
|---|---|---|---|
| 20261028120000 | `nucleo_multitenant.sql` | 28/10/2026 | 12 tabelas, RLS, funções, Storage |
| 20261028140000 | `corrige_exclusoes.sql` | 28/10/2026 | exclusão de escritório/usuário (defeito achado no teste real) |
| 20261028150000 | `status_convites.sql` | 28/10/2026 | situação do escritório na RLS; fecha UPDATE de status pelo titular |

## Procedimento (sempre nesta ordem)
1. `pnpm test:db` — aplica todas as migrations num Postgres embutido e roda os testes de RLS.
2. `pnpm db:migrate:dry` — executa cada migration pendente no Supabase dentro de `BEGIN … ROLLBACK` (valida no Postgres real sem gravar).
3. `pnpm db:migrate` — aplica, uma transação por arquivo, registrando em `supabase_migrations.schema_migrations` (pula as já aplicadas).
4. `RUN_REAL=1 pnpm test:real` — testes de integração no Supabase (criam e apagam dados de QA).

Credenciais: `SUPABASE_ACCESS_TOKEN` e `SUPABASE_PROJECT_REF` em `.env.local` (fora do Git). O script nunca imprime credenciais.

## Rollback
- Cada migration roda numa transação: falha = nada gravado.
- Reverter uma migration já aplicada: escrever migration nova inversa (não editar a antiga). O banco hoje **não tem dados de clientes**, então, se necessário, é possível recriar o schema `public` do zero — **só com autorização**.
- **Backup**: o plano atual do projeto precisa ser conferido no painel (Database → Backups). Restauração **não foi testada** nesta etapa — pendência do Gate 1.
