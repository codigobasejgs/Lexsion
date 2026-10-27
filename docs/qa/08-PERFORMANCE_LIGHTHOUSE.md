# 08 — Performance

## Lighthouse
**Não executado.** Não está instalado e o registro npm não respondeu (timeout) neste ambiente. Em máquina com internet: `pnpm build && pnpm start`, depois `npx lighthouse http://localhost:3000/entrar --preset=desktop` e `--form-factor=mobile`.

## Medição de laboratório (executada)
Script `tests/perf/meu-dia.perf.ts`, Chromium headless, `next start` local, service worker bloqueado, cache desativado, rota `/app/inicio`. Duas condições: sem limitação e com CPU 4× + rede ~1,6 Mbps / 150 ms (aprox. “4G lenta”).

| Condição | Viewport | JS transferido | LCP | CLS | Bloqueio longo (TBT aprox.) |
|---|---|---|---|---|---|
| Antes · sem limitação | 360 | 786 KB | 136 ms | 0 | 0 ms |
| Antes · limitada | 360 | 786 KB | 4.880 ms | 0,072 | 9 ms |
| Depois · sem limitação | 360 | 759 KB | 156 ms | 0 | 0 ms |
| Depois · limitada | 360 | 759 KB | 4.940 ms | 0,072 | 5 ms |
| Depois · limitada | 1440 | 968 KB | 4.956 ms | 0,009 | 19 ms |

(LCP limitado varia ~±100 ms entre execuções; a diferença antes/depois está dentro do ruído.)

## Tamanho da primeira carga (scripts referenciados no HTML da rota, build de produção)
| Rota | Antes (bruto / gzip) | Depois (bruto / gzip) |
|---|---|---|
| `/app/inicio` | 799 / 247 KB | 772 / 239 KB |
| `/app/financeiro` | 838 / 259 KB | 811 / 251 KB |
| `/app/crm` | 923 / 283 KB | 896 / 275 KB |
| `/portal` | 727 / 226 KB | 727 / 226 KB |
| `/entrar` | 714 / 221 KB | 714 / 221 KB |

Otimização aplicada: paleta de comandos (inclui índice de 29 artigos) e ajuda contextual leve carregadas sob demanda. Testes de comportamento reexecutados depois.

## Leitura honesta
- Em rede lenta simulada, o LCP (~4,9 s) **fica acima da meta de 2,5 s**. O peso dominante é o próprio framework (React DOM ~224 KB bruto) e as fixtures da demonstração, que ficam no pacote do cliente porque a demo não tem servidor.
- Com backend, as fixtures saem do bundle e os dados chegam por rota; esse é o maior ganho disponível. Outras opções: carregar `zod` só nas telas de formulário; reduzir ícones.
- Segunda visita usa o service worker (estáticos em cache) e não foi medida como “primeira carga”.
- INP não medido (exige interação real de campo).
