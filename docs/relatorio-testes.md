# Relatório de testes — 26/10/2026

Ambiente: Windows 10, Node 22.17.1, pnpm 10.13.1, Playwright 1.64 (Chromium headless), build de produção (`pnpm build && pnpm start -p 3100`).

| Comando | Resultado |
|---|---|
| `pnpm lint` | 0 problemas |
| `pnpm typecheck` | ok |
| `pnpm test` (Vitest) | **53 passaram** em 7 arquivos |
| `pnpm build` | ok (91 páginas geradas) |
| `pnpm test:e2e` | **129 passaram, 2 pulados de propósito** (mobile: troca de escritório no header e SW — rodam no desktop) |
| `pnpm capture:help` | 32 prints gerados (27 desktop 1280×800, 5 celular 390×844) |
| Estabilidade jornada 1 | `--repeat-each=5`: 10/10 |

## Cobertura E2E
- Seis jornadas do prompt (`journeys.spec.ts`): campanha→contrato→parcelas; previdenciário; prazo→agenda→Meu dia; financeiro (7 parcelas, parcial, renegociação, recibo, conciliação); falha de integração com fila sem duplicar; aprendizagem (tour pausado/retomado + artigo).
- Isolamento: portal do cliente, troca de escritório, superadmin só agregado, perfil sem permissão.
- Varredura de 41 rotas × 2 viewports (360 e 1440): renderiza, sem rolagem horizontal, axe WCAG 2.2 AA sem violações sérias/críticas.
- PWA: manifest e ícones, offline após visita, nada de `/api`/RSC em cache, atualização entre builds sem loop.

## Correções feitas por causa dos testes (esta rodada)
- `<ul>` dentro de `<dl>` no contrato (axe `definition-list`).
- Rolagem horizontal no celular: grades sem `minmax(0,1fr)` em Cálculos, Caixa e Equipe.
- Tabelas roláveis sem foco de teclado (axe `scrollable-region-focusable`) em Caixa e Equipe.
- Botão “Registrar pagamento” dos cartões do celular sem âncora de tour.

## Não testado
- Firefox e WebKit (navegadores não instalados — ver D15).
- Aparelhos reais (Android, iPhone, tablets), leitores de tela, zoom 200%: **não testados**.
- Lighthouse/Core Web Vitals de campo.
