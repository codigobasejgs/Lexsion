# 18 — Relatório QA Master

Matriz completa (uma linha por teste, resultado real): `18-MATRIZ_QA_MASTER.csv` (258 linhas). Logs: `logs/e2e-final.txt`, `logs/unit-final.txt`.

## Execuções (27/10/2026, build de produção local)
| Suíte | Resultado | Observação |
|---|---|---|
| Lint (ESLint) | 0 erros | |
| Typecheck (`tsc --noEmit`) | 0 erros | |
| Unitários (Vitest) | 119 PASS · 1 não executado | o não executado só roda com `DOCX_SAMPLE` (grava amostra para abrir no Word) |
| E2E completo (Playwright) | **258 PASS · 0 FAIL** | `mobile-360`, `desktop-1440`, `pwa-update` |
| E2E após últimos ajustes | 30 + 14 + 2 PASS | `lexsion-site`, `lexsion-rbac` (incl. QA-RBAC-06/07), detalhes via lista |
| Performance (laboratório) | 9 medições | `14-PERFORMANCE-A11Y.md` |
| `pnpm audit` | sem vulnerabilidades | |
| Varredura de segredos (histórico Git) | 0 ocorrências | |

## Cobertura
| Dimensão | Valor |
|---|---|
| Rotas (páginas) | 101 inventariadas, 101 visitadas por teste/captura |
| Viewports E2E | 360×800 (Pixel 7) e 1440×900; varredura 320–1440 (7 larguras) + zoom 200% |
| Navegador | Chromium (Playwright). Firefox/WebKit e aparelhos físicos **não executados** neste ambiente |
| Acessibilidade | axe WCAG 2.2 AA sem violação séria/crítica nas rotas visitadas; tema claro incluído |
| Prints | 42 da ajuda + 20 da landing, capturados do app real |

## Não executado (motivo real)
- Lighthouse: não instalado neste ambiente (medição equivalente por Playwright/CDP).
- Safari/iOS, Firefox, Android físico: sem aparelho/navegador no ambiente.
- Leitor de tela real: não disponível.
- Fluxos com backend (login real, e-mail, WhatsApp, cobrança): fora do escopo desta fase.
