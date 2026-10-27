# 06 — PWA e navegadores

## PWA (verificado por teste)
| Item | Evidência |
|---|---|
| Manifest: `id`, `name`, `short_name`, `lang pt-BR`, `display standalone`, `scope /`, `start_url /app/inicio?origem=pwa`, ícones 192/512 `any` + `maskable` + monocromático, atalhos | `src/app/manifest.ts`; E2E “manifest válido e ícones carregam” |
| Service worker versionado por build, controla a página após visita | `public/sw.js` + `scripts/stamp-sw.mjs`; E2E |
| Offline: shell de rotas visitadas + dados no IndexedDB; rota não visitada → `/offline` | E2E |
| Nada de `/api`, RSC ou requisição não-GET em cache | E2E (lista as chaves de cache) |
| Atualização A→B: bloqueia com edição aberta, um único recarregamento, rota preservada | `pwa-update.spec.ts` |
| Aviso “Sem conexão” aparece e some | QR PWA-03 |
| Armazenamento bloqueado: funciona em memória, com aviso | QR ROB-01 |
| Sair e “Restaurar demonstração” apagam o cache de telas | `providers.tsx` (`clearShellCache`) |
| iOS: sem botão de instalar falso; instrução “Compartilhar → Adicionar à Tela de Início” | `components/pwa.tsx` (estado `unsupported`) |

Limitação desta fase: as telas do escritório são “shell” sem dados no HTML (dados ficam no navegador). Com backend, o HTML autenticado passa a NetworkOnly (`docs/politica-offline.md`).

## Navegadores
| Navegador | Resultado | Detalhe |
|---|---|---|
| Chromium (Playwright 1.64) | PASS — 204 testes | mobile 360 (perfil Pixel 7) e desktop 1440 |
| Firefox | **BLOQUEADO** | `pnpm exec playwright install firefox webkit` → `connect ECONNREFUSED 127.0.0.1:1081` (proxy configurado no ambiente); sem proxy → `connect ETIMEDOUT` para o servidor de download. |
| WebKit (Safari) | **BLOQUEADO** | mesmo motivo |

Para destravar em máquina com internet: `pnpm exec playwright install firefox webkit` e acrescentar em `playwright.config.ts`:
```ts
{ name: "firefox", use: { ...devices["Desktop Firefox"] }, testIgnore: /pwa-update|shots/ },
{ name: "webkit-iphone", use: { ...devices["iPhone 13"] }, testIgnore: /pwa-update|shots/ },
```

## Aparelhos físicos — roteiro de aceitação manual (não executado)
Nenhum aparelho físico foi testado. Preencher uma linha por aparelho.

| Modelo | Sistema | Navegador | Data | Responsável | Instalou PWA? | Abre offline após visita? | Atualização com formulário aberto bloqueia? | Foto pela câmera no portal | Girar tela | Zoom 200 % | Print |
|---|---|---|---|---|---|---|---|---|---|---|---|
| | Android | Chrome | | | | | | | | | |
| | iOS | Safari | | | | | | | | | |
| | iPadOS | Safari | | | | | | | | | |
| | Windows | Edge (app instalado) | | | | | | | | | |
