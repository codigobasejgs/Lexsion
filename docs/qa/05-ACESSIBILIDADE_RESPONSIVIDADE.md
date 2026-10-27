# 05 — Acessibilidade e responsividade

## Automatizado (executado)
| Verificação | Abrangência | Resultado |
|---|---|---|
| axe-core (WCAG 2.0/2.1/2.2 A e AA), violações sérias/críticas | 51 rotas (escritório, portal, públicas) nos viewports 360 e 1440 no tema escuro; 10 telas principais no **tema claro**; telas de referência; superadmin | 0 violações sérias/críticas |
| Rolagem horizontal da página | 29 rotas × 7 larguras (320×640, 360×800, 390×844, 768×1024, 1024×768, 1280×800, 1440×900) | 0 após correções BUG-04/05 |
| Zoom 200 % (reflow) | 1280 px a 200 % = 640 px CSS: Meu dia, Caixa, Minuta, Cálculos; diálogo “Registrar pagamento” | ações alcançáveis; diálogo dentro da tela |
| Movimento reduzido | `prefers-reduced-motion: reduce` | transições ≤ 0,01 ms |
| Contraste | pares do tema (botão escuro/claro, texto secundário) e cor white-label | ≥ 4,5:1 (teste unitário) |
| Foco em erro | formulário de cliente e conversão de lead | foco vai ao primeiro campo inválido |
| Fechar por teclado | tour (Esc), `<dialog>` nativo (Esc) | ok |

## Decisões aplicadas
- Tabelas que precisam rolar: contêiner com `role="region"`, rótulo, `tabIndex=0`, e versão em cartões no celular (Parcelas, Caixa, listas genéricas).
- `.overflow-x-auto` sempre `position: relative` (impede vazamento de elementos `sr-only`).
- Campos com `min-w-0 max-w-full`; textos técnicos longos quebram linha.
- Diálogos: cabeçalho fixo e corpo rolável (telas baixas, teclado virtual).
- Alvos de toque ≥ 44 px em ponteiro grosso.

## Não executado (declarado)
- Leitores de tela (NVDA, VoiceOver, TalkBack): **não testados**.
- Navegação completa por Tab em todos os fluxos: **parcial** (diálogos, tour e formulários principais).
- Aparelhos físicos (teclado virtual real, notch, orientação): **não testados** — roteiro em 06.
