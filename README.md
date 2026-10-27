# SIWILTEC — ERP jurídico (frontend demonstrativo + PWA)

Plataforma de gestão de escritórios de advocacia: atendimento, CRM, clientes, casos, controladoria, previdenciário, cálculos, minutas, financeiro, portal do cliente e treinamento. **Ambiente demonstrativo: todos os dados são fictícios e ficam só no navegador.** Nenhuma mensagem, cobrança, assinatura, protocolo ou consulta externa é real. “SIWILTEC” é nome de trabalho (ver `docs/DECISOES_MARCA.md`).

## Requisitos
Node 22 · pnpm 10 (`corepack enable`).

## Rodar
```bash
pnpm install --frozen-lockfile
pnpm dev                 # http://localhost:3000 (sem service worker)
pnpm build && pnpm start # produção local, com PWA/offline
```
Entre em `/entrar` e escolha um perfil fictício: Administrador, Advogado(a), Atendimento, Controladoria, Financeiro, Estagiário(a), Cliente (portal) ou Superadmin. Data de referência fixa: 26/10/2026.
Para recomeçar: Configurações → Dados e LGPD → **Restaurar demonstração**.

## Scripts
| Script | Faz |
|---|---|
| `lint`, `typecheck`, `test` | ESLint, TypeScript, Vitest |
| `test:e2e` | Playwright contra o build de produção (rode `pnpm build` antes) |
| `capture:help` | Gera os prints reais da ajuda em `public/help/screenshots/<versão>/` (rode `pnpm build` antes e depois, para os artigos incluírem os prints) |
| `pwa:assets` | Regera ícones a partir do monograma provisório |
| `PERF=1 pnpm exec playwright test --project=perf-mobile --project=perf-desktop` | Medição de laboratório da primeira carga |

## Instalar como aplicativo
Chrome/Edge: “Instalar aplicativo” no Meu dia ou em Configurações → Dispositivo. iPhone/iPad (Safari): Compartilhar → “Adicionar à Tela de Início”.

## Real × simulado × backend
| Real (local) | Simulado (rotulado) | Depende do backend |
|---|---|---|
| Cadastros, funil, triagem, conversão sem duplicar, prazos com memória de contagem, agenda e .ics, baixas, estornos, renegociação, recibos, conciliação, caixa por mês, importação CSV, relatórios, **exportação DOCX**, tours, academia, persistência local, instalação PWA, offline após visita | Assistente virtual, envio de mensagens, assinatura, cobranças, publicação de campanhas, resultados previdenciários (exemplos), integrações | Autenticação, autorização (RLS), WhatsApp/Evolution, e-mail, pagamentos, assinatura, push, OCR, IA, fontes processuais |

A autorização por perfil é **apenas visual**; não protege dados em produção.

## Documentação
- QA: [`docs/qa/10-RELATORIO_FINAL_QA_MASTER.md`](docs/qa/10-RELATORIO_FINAL_QA_MASTER.md) (e 00–09)
- [Matriz de requisitos](docs/MATRIZ_REQUISITOS_ATUALIZADA.md) · [Mapa de módulos](docs/MAPA_DE_MODULOS_ATUALIZADO.md) · [Matriz Tícius](docs/MATRIZ_TICIUS.md)
- [Arquitetura](docs/ARQUITETURA_ATUALIZADA.md) · [Integrações fase 2](docs/INTEGRACOES_BACKEND_FASE_2.md) · [Decisões](docs/decisoes.md) · [Política offline](docs/politica-offline.md)
- [Guia do usuário](docs/GUIA_USUARIO_LEIGO.md) · [Roteiros de demonstração](docs/roteiros-demo.md) · [Guia de importação](docs/guia-importacao.md)
- [GitHub e Vercel](docs/GUIA_GITHUB_VERCEL.md) · [Marca](docs/DECISOES_MARCA.md) · [Itens que dependem da cliente](docs/ITENS_DEPENDENTES_CLIENTE.md)
