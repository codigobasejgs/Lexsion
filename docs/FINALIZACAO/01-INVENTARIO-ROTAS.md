# 01 — Inventário de rotas

Gerado por script a partir de `src/app/**/page.tsx` e dos arquivos de teste (`tests/**`) em 27/10/2026. Autorização por papel é **visual** nesta fase (ver `07-MULTITENANT-E-PERMISSOES.md`). `qa-responsivo` varre 29 rotas principais do ERP em 7 larguras (320–1440) e zoom 200%; `journeys`/`foundation`/`lexsion-site` aplicam axe (WCAG 2.2 AA, impacto sério/crítico) nas rotas que visitam.

Total: 101 páginas; 101 visitadas por teste automatizado ou captura (URL direta ou clique na lista).

| Rota | Público | Testes/capturas que visitam |
|---|---|---|
| `/` | Público | help-manifest.ts, help, landing, foundation, journey-e2, journeys, lexsion-erp, lexsion-onboarding, lexsion-rbac, lexsion-saas, lexsion-site, pwa-update, qa-docx, qa-fluxos, qa-responsivo, qa-robustez, shots, chunks.perf.ts, landing.perf.ts, meu-dia.perf.ts, producao.smoke.ts, adapters, contrast, crm, docx, domain-e3e7, email-templates, importer, qr, rbac, recurrence, tenant-brand, triage |
| `/admin` | Plataforma (superadmin, platform_admin, platform_support) | help-manifest.ts, foundation, journeys, lexsion-rbac, lexsion-site |
| `/admin/auditoria` | Plataforma (superadmin, platform_admin, platform_support) | lexsion-saas |
| `/admin/faturamento` | Plataforma (superadmin, platform_admin, platform_support) | lexsion-saas |
| `/admin/integracoes` | Plataforma (superadmin, platform_admin, platform_support) | lexsion-onboarding |
| `/admin/organizacoes` | Plataforma (superadmin, platform_admin, platform_support) | journeys, lexsion-rbac, lexsion-saas, tenant-brand |
| `/admin/planos` | Plataforma (superadmin, platform_admin, platform_support) | lexsion-saas |
| `/admin/suporte` | Plataforma (superadmin, platform_admin, platform_support) | journeys |
| `/app/academia` | Equipe do escritório (por área) | journeys, qa-fluxos, qa-responsivo |
| `/app/agenda` | Equipe do escritório (por área) | help-manifest.ts, foundation, journeys, lexsion-saas, qa-responsivo |
| `/app/ajuda` | Equipe do escritório (por área) | help-manifest.ts, journeys, qa-fluxos |
| `/app/ajuda/[slug]` | Equipe do escritório (por área) | journeys, qa-responsivo |
| `/app/assinaturas` | Equipe do escritório (por área) | journeys |
| `/app/atendimento` | Equipe do escritório (por área) | qa-responsivo |
| `/app/atendimento/[conversationId]` | Equipe do escritório (por área) | help-manifest.ts, foundation, journeys, pwa-update |
| `/app/audiencias` | Equipe do escritório (por área) | journeys |
| `/app/automacoes` | Equipe do escritório (por área) | journeys |
| `/app/automacoes/[id]` | Equipe do escritório (por área) | journeys |
| `/app/automacoes/execucoes` | Equipe do escritório (por área) | journeys |
| `/app/boas-vindas` | Equipe do escritório (por área) | journeys, lexsion-onboarding |
| `/app/calculos` | Equipe do escritório (por área) | help-manifest.ts, journeys, qa-responsivo |
| `/app/calculos/[id]` | Equipe do escritório (por área) | qa-responsivo |
| `/app/casos` | Equipe do escritório (por área) | journeys, lexsion-rbac |
| `/app/casos/[id]` | Equipe do escritório (por área) | journeys, qa-fluxos, qa-responsivo |
| `/app/clientes` | Equipe do escritório (por área) | foundation, journey-e2, lexsion-erp, lexsion-onboarding, qa-fluxos, qa-responsivo, qa-robustez |
| `/app/clientes/[id]` | Equipe do escritório (por área) | help-manifest.ts, foundation, journey-e2, journeys, qa-fluxos, qa-responsivo, qa-robustez, shots |
| `/app/clientes/novo` | Equipe do escritório (por área) | help-manifest.ts, journey-e2, qa-fluxos, shots |
| `/app/configuracoes` | Equipe do escritório (por área) | help-manifest.ts, journeys, lexsion-rbac, qa-fluxos, qa-responsivo |
| `/app/configuracoes/branding` | Equipe do escritório (por área) | help-manifest.ts, lexsion-erp, lexsion-rbac, lexsion-saas |
| `/app/configuracoes/emails` | Equipe do escritório (por área) | lexsion-onboarding |
| `/app/contratos` | Equipe do escritório (por área) | journeys |
| `/app/contratos/[id]` | Equipe do escritório (por área) | help-manifest.ts, journeys, qa-responsivo |
| `/app/crm` | Equipe do escritório (por área) | help-manifest.ts, journey-e2, journeys, lexsion-rbac, qa-fluxos, qa-responsivo, qa-robustez, shots |
| `/app/crm/captura` | Equipe do escritório (por área) | journey-e2, shots |
| `/app/crm/leads/[id]` | Equipe do escritório (por área) | help-manifest.ts, qa-fluxos, shots |
| `/app/documentos` | Equipe do escritório (por área) | journeys, qa-responsivo |
| `/app/documentos/[id]` | Equipe do escritório (por área) | help-manifest.ts, journeys |
| `/app/documentos/solicitacoes` | Equipe do escritório (por área) | help-manifest.ts |
| `/app/equipe` | Equipe do escritório (por área) | help-manifest.ts, journeys, lexsion-rbac, qa-responsivo |
| `/app/financeiro` | Equipe do escritório (por área) | foundation, journeys, lexsion-rbac, qa-fluxos, qa-responsivo |
| `/app/financeiro/caixa` | Equipe do escritório (por área) | journeys, qa-fluxos, qa-responsivo |
| `/app/financeiro/conciliacao` | Equipe do escritório (por área) | help-manifest.ts, journeys, qa-responsivo |
| `/app/financeiro/pagar` | Equipe do escritório (por área) | journeys |
| `/app/financeiro/receber` | Equipe do escritório (por área) | help-manifest.ts, journeys, qa-fluxos, qa-responsivo |
| `/app/financeiro/recibos` | Equipe do escritório (por área) | help-manifest.ts, journeys, qa-responsivo |
| `/app/ia/agentes` | Equipe do escritório (por área) | journeys |
| `/app/ia/agentes/[id]` | Equipe do escritório (por área) | journeys |
| `/app/ia/execucoes` | Equipe do escritório (por área) | journeys |
| `/app/ia/objecoes` | Equipe do escritório (por área) | journeys |
| `/app/ia/simulador` | Equipe do escritório (por área) | journeys |
| `/app/importacoes` | Equipe do escritório (por área) | help-manifest.ts, journeys, qa-responsivo |
| `/app/importacoes/[id]` | Equipe do escritório (por área) | journeys |
| `/app/inicio` | Equipe do escritório (por área) | help-manifest.ts, foundation, journeys, lexsion-rbac, lexsion-saas, lexsion-site, qa-responsivo, qa-robustez, chunks.perf.ts, meu-dia.perf.ts, producao.smoke.ts, qr, tenant-brand |
| `/app/integracoes` | Equipe do escritório (por área) | journeys |
| `/app/integracoes/[provider]` | Equipe do escritório (por área) | help-manifest.ts, journeys, qa-responsivo |
| `/app/integracoes/eventos` | Equipe do escritório (por área) | journeys |
| `/app/jornal` | Equipe do escritório (por área) | help-manifest.ts, journeys, qa-fluxos |
| `/app/jornal/[id]` | Equipe do escritório (por área) | journeys |
| `/app/jornal/alertas` | Equipe do escritório (por área) | journeys |
| `/app/marketing/campanhas` | Equipe do escritório (por área) | journeys |
| `/app/marketing/conteudos` | Equipe do escritório (por área) | journeys |
| `/app/marketing/paginas` | Equipe do escritório (por área) | journeys |
| `/app/minutas` | Equipe do escritório (por área) | journeys |
| `/app/minutas/[id]` | Equipe do escritório (por área) | help-manifest.ts, journeys, qa-docx, qa-fluxos, qa-responsivo |
| `/app/modelos` | Equipe do escritório (por área) | journeys |
| `/app/pagamentos` | Equipe do escritório (por área) | journeys, qa-responsivo |
| `/app/pericias` | Equipe do escritório (por área) | journeys |
| `/app/pesquisa` | Equipe do escritório (por área) | journeys |
| `/app/prazos` | Equipe do escritório (por área) | help-manifest.ts, journeys, qa-fluxos, qa-responsivo |
| `/app/previdenciario` | Equipe do escritório (por área) | journeys |
| `/app/previdenciario/analises/[id]` | Equipe do escritório (por área) | help-manifest.ts, foundation, journeys, qa-responsivo |
| `/app/previdenciario/planejamentos/[id]` | Equipe do escritório (por área) | journeys |
| `/app/processos` | Equipe do escritório (por área) | journeys, qa-responsivo |
| `/app/propostas` | Equipe do escritório (por área) | journeys |
| `/app/propostas/[id]` | Equipe do escritório (por área) | help-manifest.ts, journeys, qa-responsivo |
| `/app/propostas/nova` | Equipe do escritório (por área) | help-manifest.ts, qa-responsivo |
| `/app/publicacoes` | Equipe do escritório (por área) | journeys |
| `/app/relatorios` | Equipe do escritório (por área) | help-manifest.ts, journeys, qa-responsivo |
| `/app/requisitorios` | Equipe do escritório (por área) | help-manifest.ts, journeys |
| `/app/requisitorios/[id]` | Equipe do escritório (por área) | journeys |
| `/app/tarefas` | Equipe do escritório (por área) | help-manifest.ts, journeys, lexsion-erp, lexsion-saas, qa-fluxos, qa-responsivo, qa-robustez |
| `/boas-vindas` | Público | journeys, lexsion-onboarding |
| `/contato` | Público | lexsion-site |
| `/demo/tenant/[slug]` | Público (demo do escritório) | foundation, lexsion-saas, producao.smoke.ts, qr, tenant-brand |
| `/demonstracao` | Público | help-manifest.ts, help, landing, foundation, journey-e2, journeys, lexsion-erp, lexsion-onboarding, lexsion-rbac, lexsion-saas, lexsion-site, pwa-update, qa-docx, qa-fluxos, qa-responsivo, qa-robustez, shots, chunks.perf.ts, meu-dia.perf.ts, producao.smoke.ts |
| `/design-system` | Público | journeys |
| `/entrar` | Público | foundation, lexsion-saas, lexsion-site |
| `/funcionalidades` | Público | lexsion-site |
| `/instalar` | Público | lexsion-site |
| `/offline` | Público | journeys |
| `/planos` | Público | lexsion-saas, lexsion-site |
| `/portal` | Cliente (portal) | qa-fluxos |
| `/portal/ajuda` | Cliente (portal) | journeys |
| `/portal/casos/[id]` | Cliente (portal) | qa-fluxos |
| `/portal/documentos` | Cliente (portal) | journeys |
| `/portal/pagamentos` | Cliente (portal) | journeys |
| `/privacidade` | Público | lexsion-site |
| `/recuperar-acesso` | Público | journeys, lexsion-site |
| `/sobre` | Público | lexsion-site |
| `/solucoes` | Público | lexsion-site |
| `/termos` | Público | lexsion-site |

Rotas técnicas (não são páginas): `/sitemap.xml`, `/robots.txt`, `/pwa/[key]/manifest.webmanifest`, `/sw.js`, `not-found`.
