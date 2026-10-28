# 00 — Auditoria inicial (28/10/2026)

| Item | Valor |
|---|---|
| Repositório | `siwiltec` (a pasta `LEXSION` só contém marca) |
| Branch de origem | `paridade-5-plataformas` @ `186ecad` (local, não publicada) |
| Branch desta etapa | `implantacao-real` (local; **sem push**, `main` intocada) |
| Produção web (`lexsion.com.br`) | intocada nesta etapa (último deploy autorizado: 28/10, `529d2f7`) |

## Estado encontrado
- **Todo dado de usuário** ficava no navegador (IndexedDB `siwiltec-demo`, `src/services/mock/*`). 75 de 104 páginas leem/gravam esse armazenamento.
- **Login**: adaptador "não configurado" (`notConfiguredAuth`); perfis fictícios só em `/demonstracao`.
- **Integrações**: todas em `planned/demo/requires_credentials` (`src/services/adapters.ts`); nenhuma chamada de rede.
- Padrões encontrados no código: `services/mock` em 71 arquivos, `mocks/` em 37, `SimulatedBadge` em 19, `localStorage` em 6 (preferências e sessão demo), `setTimeout` em 5 (nenhum simula efeito de pagamento/envio; 1 iguala o tempo de resposta do login).
- **Supabase** (`mrpuvjmangwgszfdzeiu`, Postgres 17.11, us-east-1): **vazio** — 0 tabelas em `public`, 0 buckets, 0 usuários; cadastro público **aberto**, senha mínima 6, `site_url` = localhost.
- **Resend**: a chave fornecida é **restrita a envio** (não lista domínios nem eventos).
- Ferramentas locais: sem Docker (impede `supabase start`); PostgreSQL 18 instalado está incompleto (falta `dict_snowball`; `initdb` falha). Testes de banco locais usam **PGlite** (Postgres 18.6 em WebAssembly), aplicando as mesmas migrations.

## Segredos
- Nenhum segredo no repositório nem no histórico Git (varredura de padrões `sb_secret_`, `sbp_`, `re_`, `vcp_`, `cfut_`, JWT, chaves privadas: 0).
- **Comprometidos** (colados na conversa): senha Gmail, token Vercel, chave Resend, chaves Supabase (secret, legacy JWT), token de acesso Supabase, tokens Cloudflare. Ficaram só em `.env.local` (fora do Git) para esta implantação. **Rotacionar todos** (ver `11-…`).

## Baseline desta etapa
`pnpm test` 141 PASS + 1 opcional · lint/typecheck/build OK · E2E da branch anterior: 289 PASS, 0 FAIL.
