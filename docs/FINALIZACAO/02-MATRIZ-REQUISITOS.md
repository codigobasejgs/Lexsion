# 02 — Matriz de requisitos (prompt conclusivo × código × teste)

Status: **OK** concluído e testado · **PARCIAL** · **BACKEND** depende da fase 2 · **PROPRIETÁRIO** depende de decisão/insumo.

| # | Requisito | Status | Código | Teste/evidência |
|---|---|---|---|---|
| 1 | Landing comercial em `/` | OK | `src/app/page.tsx`, `components/marketing/*`, `content/marketing.ts` | `lexsion-site` QA-ROTA-01, QA-LANDING-01..05 |
| 2 | Prints reais na landing | OK | `content/landing-shots.ts`, `tests/capture/landing.capture.ts`, `public/landing/*` | QA-LANDING-01; `pnpm capture:landing` |
| 3 | Planos sem preço inventado | OK | `src/app/planos/page.tsx` | QA-LANDING-02 (procura “R$”) |
| 4 | SEO (canonical, sitemap, robots, noindex no app) | OK | `app/sitemap.ts`, `app/robots.ts`, `app/layout.tsx` | QA-LANDING-05 |
| 5 | `/entrar` profissional e honesto | OK | `app/entrar/page.tsx`, `services/auth.ts` | QA-LOGIN-01 |
| 6 | `/demonstracao` por escritório/perfil | OK | `app/demonstracao/page.tsx` | QA-DEMO-01 |
| 7 | Recuperar acesso | OK (UX) / BACKEND (envio) | `app/recuperar-acesso/page.tsx` | QA-LOGIN-02 |
| 8 | Sair nunca apaga dados | OK | `components/providers.tsx`, `services/mock/db.ts` | DATA-02/03, unit `data-safety` |
| 9 | Restaurar demo por escritório | OK | `resetTenant` | GEN-09 |
| 10 | 3 tenants isolados | OK | `mocks/tenants.ts` | A12, BRAND-010 |
| 11 | 12 papéis + matriz | OK (visual) / BACKEND (RLS) | `domain/permissions.ts`, `app/app/equipe` | QA-RBAC-01..07, unit `rbac` |
| 12 | Super Admin completo | OK | `app/admin/*` | QA-115/120, QA-165/166, QA-RBAC-04/07 |
| 13 | Separação SaaS × honorários | OK | `domain/saas.ts`, `saas-metrics.ts` | QA-165/166 |
| 14 | Assinatura vista pelo escritório (leitura) | OK | `app/app/configuracoes` aba Assinatura | QA-RBAC-06 |
| 15 | White-label (logo, cores com contraste) | OK | `configuracoes/branding`, `lib/logo-upload.ts`, `lib/tenant-tokens.ts` | QA-050/058, unit `tenant-brand`, `contrast` |
| 16 | PWA por escritório + QR | OK | `pwa/[key]/manifest.webmanifest`, `lib/qr.ts`, `public/sw.js` | PWA-013, QA-059, unit `qr` (OpenCV 6/6) |
| 17 | Tarefa recorrente | OK | `domain/recurrence.ts`, `tasksService.setStatus` | F18-01, unit `recurrence` |
| 18 | Aniversariantes | OK | `app/app/clientes` | F18-02 |
| 19 | Linguagem simples | OK | `domain/plain-language.ts` | PREF-01, unit `plain-language` |
| 20 | Modelos de e-mail com marca | OK (prévia) / BACKEND (envio) | `domain/email-templates.ts` | WL-EMAIL-01, unit `email-templates` |
| 21 | DOCX abrível e seguro | OK | `domain/docx.ts` | DOC-03/04/05/07, unit `docx` |
| 22 | Adaptadores de integração honestos | OK | `services/adapters.ts` | E2E-21, FIN-10, unit `adapters` |
| 23 | Onboarding do escritório novo | OK | `app/app/boas-vindas` | E2E-12 |
| 24 | Ajuda, tours, prints atualizados | OK | `content/help.ts`, `tours/tours.ts`, `content/academy.ts` | HELP, HELP-05, unit `help` (prints existem) |
| 25 | Sidebar expansível + drawer móvel | OK | `components/layout/app-shell.tsx`, `app/admin/layout.tsx`, `site-shell.tsx` | RESP-03, QA-RBAC-07 (drawer admin) |
| 26 | Dark/light WCAG, zoom 200% | OK | `globals.css` | tema claro (journeys), RESP-03 |
| 27 | Sem segredo no repositório/bundle | OK | — | varredura de padrões no histórico Git (0 ocorrências) |
| 28 | Contrato backend | OK (documento) | `docs/BACKEND_FASE_2/` | — |
| 29 | Login real, e-mail, WhatsApp, cobrança | BACKEND | adaptadores prontos | — |
| 30 | Preços, termos, contatos reais | PROPRIETÁRIO | — | `20-ITENS-DEPENDENTES-DO-PROPRIETARIO.md` |
