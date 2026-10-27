# Matriz de compatibilidade

| Ambiente | Situação | Como |
|---|---|---|
| Chromium headless 360×800 (perfil Pixel 7) | Testado | Playwright `mobile-360` |
| Chromium headless 1440×900 | Testado | Playwright `desktop-1440` |
| Chromium 390×844 / 1280×800 | Capturas de ajuda | `pnpm capture:help` |
| Firefox (desktop) | **Não testado** | navegador não instalado (D15) |
| Safari / WebKit | **Não testado** | navegador não instalado (D15) |
| Android + Chrome (aparelho real) | **Não testado em aparelho real** | — |
| iPhone + Safari (aparelho real) | **Não testado em aparelho real** | — |
| Tablet (iPad/Android) | **Não testado em aparelho real** | — |
| Windows + Edge instalado como app | **Não testado** | — |
| Leitores de tela (NVDA, VoiceOver, TalkBack) | **Não testado** | só axe automatizado |

## Para homologar
1. `pnpm exec playwright install firefox webkit` e adicionar projetos em `playwright.config.ts`.
2. Em aparelhos reais: instalar PWA, abrir offline após visita, atualizar com formulário aberto, enviar foto pela câmera no portal, girar a tela, zoom 200%.
3. Registrar navegador/versão/aparelho nesta tabela.
