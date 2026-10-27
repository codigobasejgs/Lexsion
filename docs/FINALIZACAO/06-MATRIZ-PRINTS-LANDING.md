# 06 — Matriz de prints da landing

Todos capturados do próprio app (dados fictícios) por `tests/capture/landing.capture.ts`; catálogo em `src/content/landing-shots.ts`. Regerar: `pnpm build && pnpm capture:landing`. Saída: `public/landing/<id>-desktop.webp` (1440×900) e `<id>-mobile.webp` (720 px de largura, recapturados em 27/10/2026 após o layout final).

| id | Tela | Rota capturada | Perfil fictício | Elemento aguardado |
|---|---|---|---|---|
| meu-dia | Meu dia | `/app/inicio` | Helena Prado (admin) | `[data-tour=meu-dia-lista]` |
| crm | Atendimento e funil | `/app/crm` | Beatriz Lima (atendimento) | `[data-tour=funil]` |
| caso | Casos e processos | `/app/casos/k-maria-bpc` | Rafael Nunes (advogado) | `h1` |
| agenda | Agenda | `/app/agenda` | Dora Sampaio (controladoria) | `h1` |
| minuta | Minutas e Word | `/app/minutas/dr-lucia` | Rafael Nunes | `[data-tour=editor-minuta]` |
| previdenciario | Previdenciário | `/app/previdenciario/analises/pa-joao` | Rafael Nunes | `h1` |
| financeiro | Honorários e financeiro | `/app/financeiro` | Caio Martins (financeiro) | `h1` |
| identidade | Marca e aplicativo | `/app/configuracoes/branding` | Helena Prado | `h1` |
| portal | Portal do cliente | `/portal` | Maria das Graças (cliente) | `h1` |
| superadmin | Gestão da plataforma | `/admin` | Suporte LexSion | `h1` |

Testes: QA-LANDING-01 (carregam, têm `alt`, ampliam em diálogo), QA-LANDING-03 (links internos existem).
Performance: imagem ampliada só baixa ao abrir; primeiro print com `fetchPriority=high` (ver `14-PERFORMANCE-A11Y.md`).
