# SIWILTEC — frontend demonstrativo + PWA

Plataforma de gestão de escritórios de advocacia (23 módulos). **Ambiente demonstrativo: todos os dados são fictícios e ficam só no navegador.** Nenhuma mensagem, cobrança, assinatura, protocolo ou consulta externa é real.

## Rodar
```bash
pnpm install
pnpm dev                 # http://localhost:3000 (sem service worker)
pnpm build && pnpm start # produção local, com PWA/offline
```
Entre em `/entrar` e escolha um perfil (8 perfis, 2 escritórios). Data de referência fixa: 26/10/2026.

## Scripts
| Script | Faz |
|---|---|
| `lint`, `typecheck`, `test` | ESLint, TypeScript, Vitest |
| `test:e2e` | Playwright contra o build de produção (rode `pnpm build` antes) |
| `capture:help` | Gera os prints reais da central de ajuda (`public/help/screenshots/<versão>/`) — rode `pnpm build` antes e de novo depois, para os artigos incluírem os prints |
| `pwa:assets` | Regera ícones a partir do monograma provisório |

## O que é real × simulado
| Real (local) | Simulado (rotulado na tela) | Depende do backend |
|---|---|---|
| Cadastros, funil, conversão sem duplicar, prazos com memória de contagem, agenda e .ics, baixas, estornos, renegociação, recibos, conciliação, importação CSV, relatórios, tours, academia, persistência IndexedDB, instalação PWA, offline após visita | Assistente virtual, envio de mensagens, assinatura, cobranças, publicação de campanhas, resultados previdenciários (fixos), integrações | Autenticação, autorização (RLS), WhatsApp/Evolution, e-mail, pagamentos, assinatura, push, OCR, IA |

A autorização por perfil é **apenas visual**; não protege dados em produção.

## Documentação
- [Progresso](docs/progresso.md) · [Matriz de requisitos](docs/matriz-requisitos.md) · [Relatório de testes](docs/relatorio-testes.md)
- [Arquitetura e adapters](docs/arquitetura.md) · [Backlog do backend](docs/backlog-backend.md) · [Decisões](docs/decisoes.md)
- [Política offline](docs/politica-offline.md) · [Compatibilidade](docs/matriz-compatibilidade.md) · [Performance](docs/performance.md)
- [Roteiros de demonstração](docs/roteiros-demo.md) · [Guia de importação](docs/guia-importacao.md) · [GitHub e Vercel](docs/deploy-vercel.md)
