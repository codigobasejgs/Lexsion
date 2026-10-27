# 09 — White-label e PWA

## Identidade do escritório (`/app/configuracoes/branding`)
- Nome exibido, nome curto do app (≤ 12), logotipo claro/escuro, cores primária/secundária/destaque, fundos, densidade, tamanho de texto, movimento reduzido, linguagem simples, “Tecnologia LexSion”.
- Upload: PNG/JPEG/WebP até 2 MB, 64–4096 px; tipo conferido por *magic bytes*; **SVG recusado**; imagem reencodada em PNG (`lib/logo-upload.ts`).
- Contraste: cor que não atinge 4,5:1 é escurecida/clareada automaticamente, sem perder a escolha salva (`lib/tenant-tokens.ts`).
- Permissão: só quem tem `gerir_marca` edita; gestor vê em leitura (QA-RBAC-03).

## PWA por contexto
| Contexto | Manifest | `start_url` | Ícones |
|---|---|---|---|
| Plataforma LexSion | `/pwa/lexsion/manifest.webmanifest` | `/demonstracao?origem=pwa` | `public/icons/*` (dos SVG originais LexSion) |
| Super Admin | `/pwa/admin/...` | `/admin` | LexSion |
| ERP do escritório | `/pwa/erp-<slug>/...` | `/app/inicio` | `public/tenants/<slug>/*` |
| Portal do cliente | `/pwa/portal-<slug>/...` | `/portal` | do escritório |

- `id` estável por manifest; um único `<link rel=manifest>` por página (PWA-013).
- Service worker: cache de shell separado por contexto (`siwiltec-<ctx>-shell-<versão>`), limpo ao sair (DATA-03); nunca cacheia `/api`.
- “Meu aplicativo”: QR Code gerado localmente (`lib/qr.ts`, versões 1–10, nível M), verificado por leitura OpenCV (6/6); avisa quando o endereço é de rede local (QA-059).

## Limitações
- Domínio próprio por escritório depende de DNS e backend (campo `hostname` é reservado).
- Ícone do app instalado no aparelho só muda quando o sistema operacional atualiza o manifest (comportamento do navegador).
- Teste em aparelho físico (iOS/Android) não executado neste ambiente.
