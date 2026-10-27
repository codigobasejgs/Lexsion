# Performance

Medição local em 26/10/2026, build de produção, Chromium headless (Playwright), **sem throttling de rede/CPU**, service worker bloqueado e cache desativado. Rota: `/app/inicio` (Meu dia), perfil Administrador.

| Viewport | JS transferido | CSS | DOMContentLoaded | load | FCP |
|---|---|---|---|---|---|
| 360 (Pixel 7) | 804 KB | 50 KB | 39 ms | 76 ms | 104 ms |
| 1440 (desktop) | 1.044 KB | 50 KB | 33 ms | 63 ms | 96 ms |

Totais do build (sem compressão): 99 arquivos JS somando 2.051 KB; CSS 50 KB. Maior chunk: 224 KB.

Os tempos são de servidor local (localhost) e **não representam** rede móvel real. Lighthouse e Core Web Vitals de campo **não foram executados**.

## Observações
- Valores de “JS transferido” são bytes de rede reportados pelo DevTools Protocol (servidor `next start` sem compressão em localhost); em produção na Vercel há compressão.
- Com o service worker ativo, a segunda visita carrega estáticos do cache (0 KB de rede medidos).
- Candidatos a reduzir: carregar o motor de tours e a paleta de comandos sob demanda; separar fixtures grandes por módulo.

## Como reproduzir
`pnpm build`, depois `PERF=1 pnpm exec playwright test --project=perf-mobile --project=perf-desktop` (script `tests/perf/meu-dia.perf.ts`; imprime linhas `PERF`).
