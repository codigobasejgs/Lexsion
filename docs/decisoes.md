# Decisões

| # | Decisão | Motivo | Revisar quando |
|---|---|---|---|
| D1 | Next.js 16.4.3 App Router, React 19.3, TS estrito, Tailwind 4, pnpm | Versões estáveis no scaffold; lockfile fixado | — |
| D2 | **Sem shadcn/Radix por ora**: componentes próprios mínimos (`components/ui.tsx`) + `<dialog>` nativo | `<dialog>` dá foco preso, Esc e top layer sem dependência; poucas primitivas necessárias até aqui | Precisar de combobox, popover posicionado ou menu complexo (E2+) |
| D3 | TanStack Query como única fonte de estado de domínio; sem Zustand | Uma fonte de verdade; estado de UI local basta | Estado de UI compartilhado entre rotas |
| D4 | Persistência demo em IndexedDB (uma store, coleção por chave) com fallback em memória identificado | Simples e suficiente para volume de demo | Volume > milhares de registros ou necessidade de índices |
| D5 | **Service worker manual** (`public/sw.js`), sem Serwist | Política de cache explícita em ~70 linhas; evita dependência de bundler (Turbopack) | Precisar de precache automático de todo o build |
| D6 | SW só em produção; `VERSION` reescrita por `scripts/stamp-sw.mjs` no build | Dev não é referência para offline; bytes novos disparam atualização | — |
| D7 | `experimental.useOffline` ligado; `cacheComponents` desligado | Dados vêm do cliente (IndexedDB); retry de navegação offline é útil | Backend com dados server-side |
| D8 | Tipografia: Inter (next/font, self-hosted). Serif do sistema só em títulos do portal/entrada | Uma família de UI basta (seção 4.2) | Marca definir fonte editorial |
| D9 | Tema escuro padrão; claro e sistema em Configurações | Pedido explícito Black & Gold | — |
| D10 | Monograma "SW" provisório para ícones/wordmark | Não há vetor da logo; não recortar a imagem JPEG | Receber SVG oficial |
| D11 | Autorização apenas visual (`domain/permissions.ts`) | Escopo frontend; produção exige RLS + servidor | Fase backend |
| D12 | **Motor de tours próprio** (`src/tours/runner.tsx`, ~170 linhas), sem biblioteca | Precisa esperar alvo, trocar rota, pular alvo ausente (A15), restaurar foco, persistir por usuário/papel/versão; libs avaliadas exigiriam adaptação equivalente | Tours com ramificações condicionais |
| D13 | Prints da ajuda gerados por projeto Playwright separado (`CAPTURE=1`, `tests/capture/`) | Independente da captura de QA; manifesto derivado dos próprios artigos | — |
| D14 | Artigo só exibe print que existe em disco (SSG) | Nunca mostrar imagem quebrada; teste unitário falha se faltar print | — |
| D15 | Firefox/WebKit **não** adicionados ao Playwright | Exigem download de navegadores (~200 MB); decisão do responsável | Antes da homologação |
| D16 | White-label: cor do escritório ajustada automaticamente para contraste ≥ 4,5:1 (`lib/contrast.ts`); cores de estado fixas | Marca não pode quebrar acessibilidade | — |
| D17 | Sair e “Restaurar demonstração” apagam o cache de shell do SW | Não deixar telas de sessão anterior no cache | Backend: HTML autenticado passa a NetworkOnly |
