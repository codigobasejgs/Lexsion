# 07 — Deploy em produção

| Passo | Como | Estado |
|---|---|---|
| Migrations | `pnpm db:migrate:dry` → `pnpm db:migrate` (uma transação por arquivo, registradas em `supabase_migrations`) | 6/6 aplicadas |
| Variáveis Vercel (production + preview) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (públicas por design), `SUPABASE_SECRET_KEY`, `APP_MODE` (cifradas, só servidor) | gravadas |
| Código | `paridade-5-plataformas` + `implantacao-real` → `main` por fast-forward (sem force-push) | ver registro de deploy abaixo |
| Verificação | smoke em `lexsion.com.br` com conta sintética, depois limpeza | ver `09` |

## Reversão
- Código: promover o deploy anterior na Vercel (instantâneo) ou `git revert` em `main`.
- Banco: migrations são aditivas; versão anterior do app ignora as tabelas novas. Nenhum DROP foi feito.

## Segredos
Nunca no Git, nos docs ou em `NEXT_PUBLIC_*`. Valores só em `.env.local` (fora do Git) e nas variáveis da Vercel.
