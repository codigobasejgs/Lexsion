# Arquitetura do frontend (27/10/2026)

```
src/app/          rotas (App Router): /app escritório · /portal cliente · /admin SaaS · públicas
src/components/   shell, providers (sessão + TanStack Query), UI base, PWA, ajuda contextual
src/modules/      telas reutilizáveis por domínio (inbox, finance, agenda, crm/triagem…)
src/domain/       regras puras testadas: dinheiro, datas, prazos, CNJ, CRM, triagem, comercial, CSV, DOCX, métricas
src/lib/          utilidades: money, dates, contraste, zip
src/services/     contracts.ts (interfaces dos provedores) + mock/ (adapter demo em IndexedDB)
src/mocks/        fixtures fictícias (FIXTURE_VERSION 4) e relógio fixo 26/10/2026
src/content/      artigos de ajuda, academia, índice rota→artigo→tour
src/tours/        definições, progresso e motor de tours
public/sw.js      service worker manual (política em docs/politica-offline.md)
tests/            unit (Vitest) · e2e (Playwright) · capture (prints da ajuda) · perf
```

## Fluxo de dados (fonte única)
Tela → `useCollection(nome)` (TanStack Query, chave `[nome, orgId]`) → `services/mock/*` → IndexedDB `siwiltec-demo`.
Escrita: `useAction(...).run(fn)` → serviço → `writeMany` (uma transação) → invalida as coleções e a auditoria → todas as telas que leem a coleção se atualizam. Outras abas recebem por BroadcastChannel.
Sem IndexedDB ou com `localStorage` bloqueado: mesmo código em memória + aviso global (`onStorageModeChange`).
Banco versionado: mudança de `FIXTURE_VERSION` recria o banco demo (testado com banco antigo e sessão corrompida).

## Regras de domínio relevantes
- Dinheiro em centavos inteiros; última parcela absorve o resto do arredondamento.
- Datas civis (`yyyy-mm-dd`) nunca passam por UTC; exibição em `America/Sao_Paulo`.
- Prazo: proposto (memória de contagem + versão do calendário) → confirmado por advogado(a) → cumprido.
- Contrato só conclui com todos os signatários obrigatórios; evento repetido não gera parcelas.
- Minuta: aprovação bloqueada com campo não preenchido; texto alterado após aprovação invalida a aprovação; DOCX só após aprovação.
- Portal: só atualizações publicadas por advogado(a)/admin.
- Triagem: perguntas por área vindas de dados; só gera checklist e encaminhamento.

## DOCX
`src/lib/zip.ts` (ZIP STORE + CRC32, ~100 linhas) e `src/domain/docx.ts` (OOXML: `[Content_Types]`, `_rels`, `document`, `styles`, cabeçalho e rodapé). Sem dependência nova (o ambiente não tinha acesso ao npm; a solução também evita ~400 KB de biblioteca). Texto é sempre escapado para XML.

## Troca para backend
`services/contracts.ts` define `Result<T>`, `RequestContext` (organização, ator, chave de idempotência) e as interfaces de provedor. Cada serviço mock tem a assinatura que o adapter real deve ter; as regras de `src/domain` são reaproveitáveis no servidor. Detalhe por provedor em `INTEGRACOES_BACKEND_FASE_2.md`.
