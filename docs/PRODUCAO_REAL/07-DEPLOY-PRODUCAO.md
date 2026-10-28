# 07 — Deploy em produção

| Passo | Como | Estado |
|---|---|---|
| Migrations | `pnpm db:migrate:dry` → `pnpm db:migrate` (uma transação por arquivo, registradas em `supabase_migrations`) | 6/6 aplicadas |
| Variáveis Vercel (production + preview) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (públicas por design), `SUPABASE_SECRET_KEY`, `APP_MODE` (cifradas, só servidor) | gravadas |
| Código | `paridade-5-plataformas` + `implantacao-real` → `main` por fast-forward (sem force-push) | feito (registro abaixo) |
| Verificação | smoke em `lexsion.com.br` com conta sintética, depois limpeza | 7/7 PASS |

## Reversão
- Código: promover o deploy anterior na Vercel (instantâneo) ou `git revert` em `main`.
- Banco: migrations são aditivas; versão anterior do app ignora as tabelas novas. Nenhum DROP foi feito.

## Segredos
Nunca no Git, nos docs ou em `NEXT_PUBLIC_*`. Valores só em `.env.local` (fora do Git) e nas variáveis da Vercel.

## Registro (28/10/2026)
| Hora | Evento | Resultado |
|---|---|---|
| 14:18 | `main` → `d0e5ac7` (fast-forward de `implantacao-real`) | deploy Vercel READY |
| 14:43 | `main` → `feca285` (sessão tenta de novo antes de "Sem conexão") | deploy Vercel READY |
| 14:45 | Smoke em `https://lexsion.com.br` com contas e escritórios sintéticos `qa-…@lexsion-qa.invalid` | **7/7 PASS** (login, isolamento, papéis, portal com upload, liberação de portal, bloqueio de provedor) |
| 14:47 | Limpeza conferida no banco | 0 escritórios, 0 registros, 0 arquivos, 0 vínculos; restam só o dono e o QA fixo |
| — | Varredura do bundle do navegador | 130 arquivos, 0 segredos |

Deploy anterior (`529d2f7`) continua disponível na Vercel para reversão imediata.
