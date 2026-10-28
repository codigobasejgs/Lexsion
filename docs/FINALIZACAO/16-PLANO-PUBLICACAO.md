# 16 — Plano de publicação

Estado: **publicado em 28/10/2026** por push direto (fast-forward, sem force) em `main` (`c3ae05b` → `790b0b5`), por decisão do proprietário, sem etapa de preview. Pós-deploy verificado: `/`, `/demonstracao`, `/entrar`, `/sitemap.xml`, `/robots.txt`, manifest → 200; `Permissions-Policy` presente; `pnpm test:smoke` 4/4 PASS. O roteiro abaixo fica para as próximas publicações.

## Opção recomendada: preview antes de produção
1. Revisar o diff: `git log --oneline origin/main..HEAD` e `git diff --stat origin/main..HEAD`.
2. Enviar para um branch de revisão (gera *preview deploy* na Vercel, sem tocar produção):
   `git push origin saas-multitenant:revisao-frontend-final`
3. Abrir PR `revisao-frontend-final → main` no GitHub; conferir o link de preview da Vercel.
4. Smoke no preview: `SMOKE_URL=<url-do-preview> pnpm test:smoke` e roteiro de 5 min (`19-ROTEIRO-DEMONSTRACAO-COMERCIAL.md`).
5. Aprovado: *merge* do PR (sem force-push). A Vercel publica em produção.
6. Pós-deploy: `SMOKE_URL=https://lexsion.com.br pnpm test:smoke`; conferir `/`, `/demonstracao`, `/sitemap.xml`, `/robots.txt` → 200.

## Critérios de autorização
- Autorização explícita do proprietário para o passo 2 (push) e para o passo 5 (produção).
- Nenhum segredo no diff (varredura já executada: 0).
- Lint, typecheck, unit e E2E verdes no último commit.

## Reversão
Na Vercel: *Promote* do deployment anterior (instantâneo). No Git: `git revert` do merge (nunca force-push).
