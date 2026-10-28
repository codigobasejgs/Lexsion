# 00 — Baseline e preservação

## Estado inicial (28/10/2026)
| Item | Valor |
|---|---|
| Raiz Git | `J:\AREA DE TRABALHO\Projetos\Siwiltec - Advogados\siwiltec` (a pasta `LEXSION` contém só ativos de marca) |
| Branch de origem | `saas-multitenant`, HEAD `529d2f7`, igual a `origin/main` (produção) |
| Trabalho local não commitado | nenhum (`git status` limpo) |
| Branch desta execução | `paridade-5-plataformas` (local, **sem push**) |
| Rotas (páginas) | 101 (`src/app/**/page.tsx`) |
| Artigos/tours/prints | 33 artigos · 18 tours · 42 prints da ajuda · 20 prints da landing |

## Baseline executada antes de alterar código (`logs/baseline-*.txt`)
| Comando | Resultado |
|---|---|
| `pnpm lint` | 0 erros |
| `pnpm typecheck` | 0 erros |
| `pnpm test` | 119 PASS · 1 opcional não executado (`DOCX_SAMPLE`) |
| `pnpm build` | OK |
| `pnpm test:e2e` | **260 PASS · 1 FAIL** — `journeys › detalhes via lista` (mobile), intermitente (1 em 4 sob carga) |

A falha da baseline foi investigada antes de qualquer outra mudança (ver `10-DIFFS-COMPATIBILIDADE.md`, item 1).

## O que NÃO foi alterado
- Identidade LexSion, tokens, logos, landing, login, demonstração, Super Admin, PWA/manifest/service worker (lógica), white-label, portal do cliente, financeiro, CRM/funil/inbox, documentos, prazos, agenda, importação, permissões (matriz de 12 papéis).
- Dados fictícios existentes: nenhuma fixture removida ou renomeada; `FIXTURE_VERSION` mantido (5) — dados criados pelo usuário na demo continuam no navegador. Coleções novas (`assessments`, `legalSources`) entram sem migração (o banco devolve a semente quando a chave não existe).
- Testes existentes: nenhum removido; dois ajustados (motivo documentado em `10-DIFFS-COMPATIBILIDADE.md`).
- Documentação anterior (`docs/FINALIZACAO`, `docs/qa`, `docs/LEXSION`, `docs/BACKEND_FASE_2`): preservada; só acréscimos.

## Segurança desta execução
- Sem push, deploy, alteração de DNS/Cloudflare, banco, pagamento, mensagem ou e-mail real.
- Nenhuma credencial copiada, usada ou gravada. As credenciais expostas em conversas anteriores continuam **pendentes de rotação pelo proprietário**.
- Nenhum login em plataforma concorrente; só páginas públicas, com resumo próprio (nada copiado).
