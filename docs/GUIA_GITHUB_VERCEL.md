# GitHub e Vercel

**Nada foi publicado.** Não houve push, criação de repositório remoto nem deploy.

## Estado local
- Repositório Git criado em 27/10/2026 em `siwiltec/` (branch `main`), com commits de checkpoint e de cada etapa. Sem remoto configurado.
- `.gitignore`: `node_modules`, `.next`, `test-results`, `playwright-report`, `.env*` (exceto `.env.example`), `*.pem`, `.vercel`, `coverage`.
- `.gitattributes`: finais de linha LF; PNG binário.
- A pasta `../Documentação/` (conversa, planilha, áudios, vídeos, imagem de marca) fica **fora** do repositório.
- Varredura de segredos sem ocorrências (`qa/07-SEGURANCA_E_PRIVACIDADE.md`).

## Enviar ao GitHub (precisa de autorização e conta)
```bash
cd siwiltec
git remote add origin https://github.com/<conta>/<repositorio-privado>.git
git push -u origin main
```
O CI (`.github/workflows/ci.yml`) roda: install congelado, lint, typecheck, Vitest, build, instalação do Chromium e E2E.

## Vercel
| Item | Valor |
|---|---|
| Framework | Next.js (detecção automática) |
| Install | `pnpm install --frozen-lockfile` |
| Build | `pnpm build` (carimba a versão de `public/sw.js` antes do `next build`) |
| Saída | `.next` (padrão) |
| Node | 22.x |
| Variáveis | nenhuma nesta fase (a demo não precisa de chave) |
| Rotas/deep links | App Router; sem rewrites; `not-found.tsx` trata 404 |
| Cabeçalhos | definidos em `next.config.ts` (nosniff, DENY, referrer); `sw.js` sem cache |
| HTTPS | obrigatório para service worker e instalação (Vercel fornece) |

Fluxo recomendado: **Preview** a cada PR para homologação; **Production** só após aprovação da cliente.

## Checklist após o primeiro deploy
- [ ] `/entrar` abre e cada perfil entra
- [ ] Recarregar `/app/casos/k-maria-bpc` direto (deep link)
- [ ] Manifest e ícones carregam; Chrome oferece instalar
- [ ] Segunda visita offline mostra o Meu dia; rota nova mostra `/offline`
- [ ] Publicar nova versão: aviso “Nova versão disponível” aparece uma vez
- [ ] Baixar DOCX de minuta aprovada e abrir no Word
- [ ] Faixa “Ambiente demonstrativo — dados fictícios” visível
