# GitHub e Vercel (preparação — nada foi publicado)

Nenhum push nem deploy foi executado. O diretório ainda **não é um repositório git**.

## GitHub
```bash
git init && git add -A && git commit -m "SIWILTEC frontend demo + PWA"
git remote add origin <url-do-repositorio-privado>
git push -u origin main
```
`.gitignore` já exclui `.next`, `node_modules`, `test-results`, `playwright-report`, `.env*` (exceto `.env.example`).
CI: `.github/workflows/ci.yml` roda lint, typecheck, Vitest, build e E2E.

## Vercel
- Framework: Next.js (detecção automática); install `pnpm install`; build `pnpm build` (carimba `public/sw.js`).
- **Preview** (cada PR): usar para homologação; o banner demo continua.
- **Production**: só após aprovação da cliente. Sem variáveis de ambiente nesta fase.
- Cabeçalhos de segurança e `sw.js` sem cache já vêm de `next.config.ts`.
- Domínio próprio: configurar depois; o PWA usa `id: /app/inicio`, independente do domínio.
