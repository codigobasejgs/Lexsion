# 11 — Treinamentos, tours e ajuda

| Item | Quantidade | Fonte |
|---|---|---|
| Artigos de ajuda | 33 | `src/content/help.ts` |
| Prints reais da ajuda | 42 (desktop e celular) | `public/help/screenshots/0.1.0/`, regerados em 27/10/2026 (`pnpm capture:help`) |
| Tours guiados | 18 | `src/tours/tours.ts` (seletores `data-tour` estáveis) |
| Trilhas da academia | 6 trilhas, 26 lições | `src/content/academy.ts` |
| Ajuda contextual por rota | “Como usar esta tela?” | `src/content/route-help.ts` |

Novos nesta fase: artigos *Trocar o logotipo e as cores*, *Instalar o aplicativo do escritório*, *Criar tarefas que se repetem*, *Gerir escritórios, planos e faturas*; tours *identidade* e *super-admin* (botão “Tour guiado” no menu do Super Admin); trilha *Rotina e identidade do escritório*.

## Por perfil
| Perfil | Trilhas |
|---|---|
| Titular, gestor | todas as do escritório (gestor: Começando, Atendimento, Jurídico, Gestão, Rotina) |
| Advogado(a) | Começando, Atendimento, Jurídico, Rotina |
| Atendimento | Começando, Atendimento, Rotina |
| Financeiro | Começando, Financeiro, Rotina |
| Controladoria, estagiário(a) | Começando, Jurídico, Rotina |
| Correspondente | Começando |
| Cliente | ajuda do portal + tour “Área do cliente” |
| Plataforma | tour Super Admin + artigo de gestão |

Garantias automáticas: todo artigo/tour citado por lição existe; todo print declarado existe (unit `help`); tours percorridos sem passo perdido (HELP, QA-RBAC-07).
Livros da autora: sem conteúdo fabricado; aguardam material (ADM-09).
