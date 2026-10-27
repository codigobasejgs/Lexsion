# LexSion — gestão para escritórios de advocacia (frontend demonstrativo + PWA)

“Toda a advocacia. Uma plataforma.” Site comercial, ERP jurídico (atendimento, CRM, casos, prazos, documentos, previdenciário, minutas, financeiro), portal do cliente, Super Admin SaaS e white-label por escritório.
**Nesta fase todos os dados são fictícios e ficam só no navegador (IndexedDB).** Nenhum login, mensagem, e-mail, cobrança ou assinatura é real. O backend (Supabase) é a fase 2: `docs/BACKEND_FASE_2/CONTRATOS_E_MODELO_DADOS.md`.

## Requisitos
Node 22 · pnpm 10 (`corepack enable`) · navegadores do Playwright (`pnpm exec playwright install chromium`).

## Rodar
```bash
pnpm install --frozen-lockfile
pnpm dev                 # http://localhost:3000 (sem service worker)
pnpm build && pnpm start # produção local, com PWA/offline
```
- `/` site comercial · `/entrar` login (acesso real ainda não ativo; não cria sessão) · `/demonstracao` escolha de perfil fictício.
- Perfis da demonstração: **Aurora Advocacia** — Helena Prado (titular), Gilberto Andrade (gestor operacional), Rafael Nunes (advogado), Beatriz Lima (atendimento), Caio Martins (financeiro), Dora Sampaio (controladoria), Lia Torres (estagiária), Renan Correspondente (parceiro externo), Maria das Graças Exemplo (cliente/portal); **Atlas Jurídico** — Otávio Reis (titular); **Novo Escritório (teste)** — Carlos Exemplo (titular, primeiro acesso); **Plataforma** — Suporte LexSion (superadmin), Paula Operações (administração), Sérgio Atendimento LexSion (suporte).
- Data de referência fixa: 26/10/2026. Recomeçar: Configurações → Dados e LGPD → **Restaurar demonstração** (só o escritório atual). Sair nunca apaga dados.

## Scripts
| Script | Faz |
|---|---|
| `lint`, `typecheck`, `test` | ESLint, TypeScript, Vitest |
| `test:e2e` | Playwright contra o build de produção (rode `pnpm build` antes; sobe `next start` na porta 3100) |
| `test:smoke` | fumaça contra um site publicado: `SMOKE_URL=https://... pnpm test:smoke` |
| `capture:help` | prints reais da ajuda → `public/help/screenshots/<versão>/` (build antes e depois) |
| `capture:landing` | prints reais da landing → `public/landing/*.webp` (build antes e depois) |
| `pwa:assets` | ícones da plataforma (SVG originais LexSion) e dos escritórios |
| `PERF=1 pnpm exec playwright test --project=perf-mobile --project=perf-desktop` | medição de laboratório (landing e Meu dia) |

## Real × simulado × backend
| Real (local) | Simulado (rotulado) | Depende do backend |
|---|---|---|
| Cadastros, funil, conversão sem duplicar, prazos, agenda/.ics, baixas e estornos, conciliação, recibos, importação CSV, relatórios, DOCX, tarefas recorrentes, marca do escritório, QR do app, Super Admin (sobre dados locais), tours e academia, PWA/offline | Assistente virtual, WhatsApp, e-mail, assinatura, cobrança, webhooks de pagamento, campanhas | Login, autorização no servidor (RLS), integrações reais, armazenamento em nuvem, push, IA |

A autorização por papel é **apenas visual**: não use com dados reais.

## Documentação
- **Finalização (atual)**: [`docs/FINALIZACAO/`](docs/FINALIZACAO/00-RESUMO_EXECUTIVO.md) — resumo, rotas, requisitos, arquitetura, design system, Super Admin, white-label/PWA, QA Master (CSV), performance, segurança, publicação, aceite.
- Backend fase 2: [`docs/BACKEND_FASE_2/`](docs/BACKEND_FASE_2/CONTRATOS_E_MODELO_DADOS.md) · [Integrações](docs/INTEGRACOES_BACKEND_FASE_2.md)
- Histórico: [`docs/qa/`](docs/qa/10-RELATORIO_FINAL_QA_MASTER.md), [`docs/LEXSION/`](docs/LEXSION/CHECKPOINT.md), [Mapa de módulos](docs/MAPA_DE_MODULOS_ATUALIZADO.md), [Matriz Tícius](docs/MATRIZ_TICIUS.md), [Decisões](docs/decisoes.md), [Política offline](docs/politica-offline.md)
- Uso: [Guia do usuário](docs/GUIA_USUARIO_LEIGO.md) · [Roteiro comercial](docs/FINALIZACAO/19-ROTEIRO-DEMONSTRACAO-COMERCIAL.md) · [Guia de importação](docs/guia-importacao.md) · [GitHub e Vercel](docs/GUIA_GITHUB_VERCEL.md)
