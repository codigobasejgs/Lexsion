# 14 — Performance e acessibilidade

## Ambiente
Medição de laboratório (não é dado de campo): build de produção (`next start`), Chromium headless do Playwright, Windows 10, service worker bloqueado, cache desativado. Duas condições: sem limitação e CPU 4× + rede ~1,6 Mbps / 150 ms. Comando: `PERF=1 pnpm exec playwright test --project=perf-mobile --project=perf-desktop`. Lighthouse não instalado neste ambiente.

## Landing `/` (antes × depois desta fase)
Otimizações: print de celular reduzido de 1024 para 720 px de largura; imagem do diálogo de ampliação só carrega ao abrir; primeiro print com `fetchPriority=high`.

| Condição | Viewport | Imagens antes | Imagens depois | LCP antes | LCP depois | CLS | TBT aprox. |
|---|---|---|---|---|---|---|---|
| sem limitação | 360 | 1.336 KB | 387 KB | 164 ms | 180 ms | 0 | 0 |
| sem limitação | 1440 | 796 KB | 797 KB | 176 ms | 188 ms | 0 | 0 |
| limitada | 360 | 923 KB | 111 KB | 2.020 ms | 1.920 ms | 0 | 165 → 55 ms |
| limitada | 1440 | 796 KB | 441 KB | 3.800 ms | 3.348 ms | 0 | 160 → 72 ms |

JS transferido: 626 KB. Variação entre execuções ~±100 ms; diferenças sem limitação estão no ruído.

## ERP `/app/inicio` (mesmo método)
| Condição | Viewport | JS | LCP | CLS |
|---|---|---|---|---|
| sem limitação | 360 / 1440 | 688 KB | 264 / 308 ms | 0 |
| limitada | 360 / 1440 | 688 KB | 4.924 / 4.936 ms | 0,072 / 0,009 |

Leitura honesta: em rede lenta o ERP fica acima da meta de 2,5 s; o peso dominante são framework + fixtures da demo no bundle (sem servidor). Com backend, os dados saem do bundle. Histórico anterior: `docs/qa/08-PERFORMANCE_LIGHTHOUSE.md`.

## Acessibilidade
- axe (WCAG 2.0/2.1/2.2 A/AA, impacto sério/crítico = 0) nas rotas de `journeys`, `foundation`, `lexsion-site`, incluindo tema claro.
- Sem rolagem horizontal em 7 larguras (320–1440) e zoom 200% (`qa-responsivo`, 29 rotas).
- `prefers-reduced-motion` zera animações (A11Y-04); foco visível; diálogos com foco preso e retorno; tours restauram foco.
- Não executado: leitor de tela real (NVDA/VoiceOver) e aparelhos físicos.
