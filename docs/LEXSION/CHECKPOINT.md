# Checkpoint de execução LexSion (retomada após interrupção)

Branch: `saas-multitenant`. Atualizar a cada etapa concluída (commit + teste).

| Etapa | Estado | Commit | Evidência |
|---|---|---|---|
| E0 baseline | feito | (logs) | `docs/EVOLUCAO_SAAS/logs/baseline-*.txt` — todos exit 0 |
| E1 dados: migração sem perda, reset por escritório, tenants persistidos | feito | aeb28d7 | tests/unit/data-safety.test.ts |
| E2 manifest/PWA por contexto, SW, proxy por host | código feito, falta E2E | | tests/unit/tenant-brand.test.ts (PWA-*, resolução) |
| E3 LexSion: assets copiados, ícones, tokens | parcial (faltam superfícies: login, shell, portal, offline, 404) | | public/brand/lexsion, scripts/pwa-assets.mjs |
| E4 white-label: tema seguro, upload, Meu aplicativo, QR | código feito, falta E2E | | logo-upload/tenant-tokens/qr + verify-qr.py (OpenCV 6/6) |
| E5 Super Admin completo + 12 perfis | em andamento (organizacoes/page.tsx e tenant-wizard.tsx não compilam) | | |
| E6 landing, onboarding, página pública, assinatura do escritório | pendente | | |
| E7 recorrência, aniversariantes, densidade, linguagem simples | pendente | | |
| E8 adapters/integrações, e-mails | pendente | | |
| E9 tours/ajuda/prints | pendente | | |
| E10 QA Master + docs | pendente | | |
