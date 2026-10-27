# 03 — Arquitetura do frontend

Next.js 16.4 (App Router) · React 19 · TypeScript estrito · Tailwind v4 · TanStack Query · Zod · Playwright · Vitest. Sem servidor de dados: tudo roda no navegador.

## Camadas
| Camada | Onde | Papel |
|---|---|---|
| Rotas | `src/app/**` | site público, `/entrar`, `/demonstracao`, `/app` (ERP), `/portal`, `/admin` |
| Shells | `components/layout/app-shell.tsx`, `app/portal/layout.tsx`, `app/admin/layout.tsx`, `components/marketing/site-shell.tsx` | navegação, drawer, marca |
| Sessão e tenant | `components/providers.tsx` | sessão demo, escritório ativo, `signOut` sem perda de dados |
| Domínio puro | `src/domain/*` | regras testáveis sem UI (prazos, CRM, financeiro, permissões, SaaS, recorrência, DOCX, e-mails) |
| Serviços mock | `src/services/mock/*` | repositórios sobre IndexedDB (`siwiltec-demo`), auditoria, idempotência |
| Adaptadores | `src/services/adapters.ts`, `services/auth.ts` | contratos para a fase 2; hoje “não configurado/demonstração” |
| Conteúdo | `src/content/*`, `src/tours/*` | landing, ajuda, academia, tours |
| Borda | `src/proxy.ts`, `lib/tenant-resolver.ts` | contexto (plataforma/escritório/portal) por host/caminho; cabeçalhos para metadados |
| PWA | `public/sw.js`, `app/pwa/[key]/manifest.webmanifest` | cache de shell por contexto, manifest por escritório |

## Armazenamento (mock)
- IndexedDB com `FIXTURE_VERSION`; `mergeSeed` migra sem apagar registros criados pelo usuário.
- Coleções de plataforma (`tenants`, `plans`, `saasInvoices`, `platformProviders`, `supportTickets`) não são apagadas por reset de escritório.
- Sem IndexedDB/localStorage: opera em memória e avisa (ROB-01).

## Fronteiras de segurança (honestas)
- Permissões são **visuais**. Qualquer pessoa com o navegador pode alterar os próprios dados locais; não há dado real.
- Nenhuma variável `NEXT_PUBLIC_*` contém segredo. `.env.example` só tem nomes.
- Fase 2 troca `services/mock` por repositórios Supabase atrás das mesmas interfaces (ver `docs/BACKEND_FASE_2`).
