# 03 — Execução automatizada

Ambiente: Windows 10 Pro 19044, Node 22.17.1, pnpm 10.13.1, Playwright 1.64.1 com Chromium headless, build de produção servido por `next start -p 3100`. Data: 27/10/2026.

| Comando | Data | Resultado | Total | Duração | Falhas | Log |
|---|---|---|---|---|---|---|
| `pnpm install --frozen-lockfile` | 27/10 | PASS | — | 1 s | 0 | `logs/baseline-install.txt` |
| `pnpm lint` | 27/10 | PASS | 0 problemas | 9 s | 0 | `logs/final-lint.txt` |
| `pnpm typecheck` | 27/10 | PASS | — | 3 s | 0 | `logs/final-typecheck.txt` |
| `pnpm test` (Vitest) | 27/10 | PASS | 67 passaram, 1 pulado (gera amostra DOCX só com `DOCX_SAMPLE`) | 0,3 s | 0 | `logs/final-test.txt` |
| `pnpm build` | 27/10 | PASS | 91+ páginas | 12 s | 0 | `logs/final-build.txt` |
| `pnpm test:e2e` (Chromium, 360 e 1440 + atualização PWA) | 27/10 | PASS | 204 passaram, 11 pulados de propósito | 75 s | 0 | `logs/final-test-e2e.txt` |
| `pnpm capture:help` | 27/10 | PASS | 38 prints (32 desktop, 6 celular) | 11 s | 0 | `public/help/screenshots/0.1.0/manifest.json` |
| `PERF=1 playwright --project=perf-*` | 27/10 | PASS (medição) | 4 medições | 12 s | — | `logs/perf-antes.txt`, `logs/perf-depois.txt` |
| Word 16 abrindo DOCX gerado | 27/10 | PASS | 1 arquivo | — | 0 | 02 · DOC-06 |
| `playwright install firefox webkit` | 27/10 | **BLOCKED** | — | — | proxy local 127.0.0.1:1081 recusa; conexão direta expira (ETIMEDOUT) | 06 |
| Lighthouse | 27/10 | **BLOCKED** | — | — | não instalado; registro npm inacessível (timeout) | 08 |

Evolução durante a rodada: baseline E2E 129 → final 204 (75 testes novos). Baseline unit 53 → 67.

## Pulados de propósito (11)
- `qa-responsivo` (8 no projeto mobile): a varredura define as 7 larguras manualmente e roda uma vez no projeto desktop.
- `foundation` troca de escritório (1 no mobile): seletor do cabeçalho existe só no desktop; no celular fica no menu do usuário.
- `foundation` service worker (1 no mobile) e `qa-fluxos` SEC-03 (1 no mobile): uma execução basta.

## Estabilidade
- Uma falha intermitente (ROB-03) apareceu na suíte completa; causa no próprio teste (BUG-11), corrigida e validada com `--repeat-each=10 --workers=10` (20/20).
- Jornada 1 (assinatura): `--repeat-each=5` 10/10 na rodada anterior.

## Novos arquivos de teste nesta rodada
`tests/unit/docx.test.ts`, `tests/unit/triage.test.ts`, extensões de `tests/unit/help.test.ts`, `tests/e2e/qa-docx.spec.ts`, `qa-robustez.spec.ts`, `qa-responsivo.spec.ts`, `qa-fluxos.spec.ts`, `tests/perf/*.perf.ts`.
