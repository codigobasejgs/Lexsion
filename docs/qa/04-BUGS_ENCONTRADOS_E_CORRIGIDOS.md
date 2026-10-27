# 04 — Bugs encontrados e corrigidos

Todos reproduzidos antes da correção e cobertos por teste de regressão que passa hoje.

| Bug | Sev. | Reprodução | Causa-raiz | Arquivos | Teste de regressão | Verificado |
|---|---|---|---|---|---|---|
| BUG-01 Minuta sem exportação Word | P1 | Abrir minuta aprovada: só `.txt`/impressão | Funcionalidade inexistente | `src/lib/zip.ts`, `src/domain/docx.ts`, `minutas/[id]/page.tsx` | `tests/unit/docx.test.ts`, `qa-docx.spec.ts` (DOC-04/05) | PASS + aberto no Word 16 |
| BUG-02 Com `localStorage` bloqueado o login não acontece | P1 | Navegação privada restrita: “Entrar como…” volta para `/entrar` sem aviso | `writeSession` engolia o erro e a sessão nunca era lida | `components/providers.tsx`, `services/mock/db.ts`, `components/pwa.tsx` | `qa-robustez.spec.ts` ROB-01 | PASS (entra, opera em memória, mostra aviso) |
| BUG-03 Minuta podia ser aprovada com campo “não preenchido” | P2 | Inserir `[cliente.nis — não preenchido]`, salvar, “Aprovar” | Regra só exibia aviso, sem bloqueio | `ops-repo.ts` (`missingFields`), `minutas/[id]/page.tsx` | `qa-docx.spec.ts` DOC-03 | PASS (botão desativado e serviço recusa) |
| BUG-04 Rolagem horizontal da página em tabelas a 768 px | P2 | `/app/financeiro` a 768×1024: página rola 41 px | `.sr-only` (absoluto) dentro de `<th>` escapava do contêiner rolável sem `position: relative` | `globals.css` (`.overflow-x-auto { position: relative }`), 7 contêineres | `qa-responsivo.spec.ts` (7 larguras × 29 rotas) | PASS |
| BUG-05 Rolagem horizontal a 320 px em Pagamentos e Análise previdenciária | P2 | 320×640: 30 px e 7 px | Grade sem `minmax(0,1fr)`; `<select>` e IDs longos; eixo da linha do tempo com margem fixa | `pagamentos/page.tsx`, `previdenciario/analises/[id]`, `.field` (`min-w-0 max-w-full`) | `qa-responsivo.spec.ts` | PASS |
| BUG-06 Diálogos cortavam ações em telas baixas (zoom 200 %) | P2 | 640×400: “Confirmar baixa” fora da tela | `<dialog>` com altura máxima mas corpo sem rolagem própria | `components/ui.tsx` | `qa-responsivo.spec.ts` RESP-03 | PASS |
| BUG-07 Aviso “Minuta salva” sumia e teste/uso recarregava o editor | P3 | Salvar minuta: aviso desaparece no mesmo instante | `key={id+updatedAt}` remontava o editor a cada gravação | `minutas/[id]/page.tsx` | `qa-docx.spec.ts` | PASS |
| BUG-08 Clique duplo em “Criar tarefa de revisão” (Jornal) duplicava tarefa | P3 | Clicar 2× rápido | id aleatório por clique | `jornal/[id]/page.tsx` (id determinístico) | `qa-fluxos.spec.ts` FLUXO E | PASS (1 tarefa) |
| BUG-09 Rascunho de atualização ia direto ao portal (não havia etapa de publicação) | P2 | Status do portal era um campo único sem revisão | Sem modelo de publicação | `types.ts` (`PortalUpdate`), `ops-repo.ts` (`portalService`), casos e portal | `qa-fluxos.spec.ts` FLUXO G / PORT-02 | PASS |
| BUG-10 Catálogo de cálculos quebrava palavra no meio (“execuçã/o”) | P3 | 390 px, print da ajuda | `overflow-wrap:anywhere` | `calculos/page.tsx` (`break-words`) | inspeção visual do print regenerado | PASS |
| BUG-12 Tema claro: cor de destaque com contraste insuficiente | P2 | Tema claro: textos em `--accent` (#a67c36) a 3,1–3,8:1 em 53 lugares | Token escolhido sem medir contra todas as superfícies; axe só rodava no tema escuro | `globals.css` (`--accent: #855e1c`) | U:contrast (todos os tokens claros × canvas/surface/muted/selection) + E2E axe no tema claro | PASS (≥ 4,7:1) |
| BUG-13 Rótulos sem contraste na prévia de landing e títulos de grupo do menu | P3 | axe `color-contrast` em Marketing → Páginas e na sidebar | Dourado escuro sobre bloco escuro; `text-fg-muted/80` (opacidade) | `marketing/paginas/page.tsx`, `app-shell.tsx` | E2E rotas (51) + tema claro | PASS |
| BUG-11 Teste ROB-03 instável sob paralelismo | P3 (teste) | 1 falha em 185 na suíte completa | Locator filtrado por `checked:false` mudava de alvo após o clique | `qa-robustez.spec.ts` | `--repeat-each=10 --workers=10`: 20/20 | PASS |

Nenhum P0 encontrado. Nenhum P1 aberto.
