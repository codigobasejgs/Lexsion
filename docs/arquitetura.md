# Arquitetura do frontend e pontos de conexão

```
src/app/            rotas (App Router). /app = escritório, /portal = cliente, /admin = SaaS
src/components/     shell, providers (sessão + TanStack Query), UI base, PWA
src/modules/        telas reutilizáveis por domínio (inbox, finance, agenda…)
src/domain/         regras puras e testadas (dinheiro, datas, prazos, CNJ, CRM, comercial, CSV, métricas)
src/services/       contracts.ts (interfaces) + mock/ (adapter demo em IndexedDB)
src/mocks/          fixtures fictícias e relógio fixo (26/10/2026)
src/content/        artigos de ajuda, academia
src/tours/          definições, progresso e motor de tours
public/sw.js        service worker manual (docs/politica-offline.md)
```

## Fluxo de dados
Tela → `useCollection(nome)` (TanStack Query, chave `[nome, orgId]`) → `services/mock/*` → IndexedDB (`siwiltec-demo`).
Escrita: `useAction(...).run(fn)` → serviço → `writeMany` (uma transação) → invalida coleções + auditoria. Outras abas recebem via BroadcastChannel.

## Troca para backend
`services/contracts.ts` define `Result<T>`, `RequestContext` (organização, ator, idempotência) e interfaces de provedor:
`PaymentProvider` (Asaas, InfinitePay, Mercado Pago), `MessagingProvider` (Evolution API), `EmailProvider` (Resend), `SignatureProvider` (ZapSign), `LegalDataProvider` (DataJud), `AIProvider`, `StorageProvider` (Supabase Storage), `AdvertisingProvider`.
Cada serviço mock tem a mesma assinatura que o adapter real deve ter. Regras de `src/domain` são reaproveitadas no servidor.

Segredos: só no servidor (route handlers / edge functions). Nenhum `NEXT_PUBLIC_*` com chave. Ver `.env.example`.
