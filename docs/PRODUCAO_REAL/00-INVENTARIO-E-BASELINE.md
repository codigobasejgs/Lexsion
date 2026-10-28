# 00 — Inventário e baseline (28/10/2026)

| Item | Estado |
|---|---|
| Código | Next.js 16 (App Router) · React 19 · Tailwind 4 · PWA · branch `main` |
| Produção web | `lexsion.com.br` (Vercel, projeto `lexsion`, deploy a partir de `main`) |
| Banco | Supabase `lexsion` (Postgres 17, us-east-1) · 6 migrations aditivas · 16 tabelas públicas, **16 com RLS** · 42 políticas |
| Auth | Supabase Auth · cadastro público fechado · convite por e-mail (SMTP Resend) · senha ≥ 10 |
| Arquivos | Bucket privado `documentos` (PDF/JPG/PNG/WEBP, 15 MB), caminho `<escritório>/<documento>/…` |
| Demonstração | `/demonstracao` e `/demo/*`: dados fictícios só no navegador (IndexedDB), nunca enviados ao servidor |

## Preservado (sem regressão)
Identidade visual, landing, 104 rotas, Super Admin, módulos jurídicos, PWA white-label, tours e ajuda.
A suíte anterior continua passando (301 E2E, 141 unitários) — ver `05`.

## O que mudou nesta implantação
- Fora de `/demonstracao`, toda tela lê e grava no Supabase com a sessão do usuário (RLS decide).
- Telas iguais: a camada `readAll/writeMany` troca o armazenamento (`src/services/real/backend.ts`).
- Ações que dependiam de simulação foram **retiradas** da operação (bloqueio ou registro manual explícito) — ver `03` e `08`.
