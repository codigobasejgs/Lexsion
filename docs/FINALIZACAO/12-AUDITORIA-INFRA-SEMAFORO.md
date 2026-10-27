# 12 — Auditoria de infraestrutura (somente leitura)

Feita em 27/10/2026 por HTTP público e DNS-over-HTTPS. **Nenhuma alteração** em Cloudflare, Vercel, Resend ou DNS. Nenhum token usado nesta verificação.

| Item | Observado | Semáforo | Ação |
|---|---|---|---|
| `lexsion.com.br` A | `76.76.21.21` (Vercel) | Verde | — |
| `www` | CNAME `cname.vercel-dns.com`, 308 → raiz | Verde | — |
| HTTPS/HSTS | `Strict-Transport-Security: max-age=63072000` | Verde | considerar `includeSubDomains; preload` após estabilizar |
| Cabeçalhos | `X-Frame-Options DENY`, `nosniff`, `Referrer-Policy` | Verde | `Permissions-Policy` adicionada localmente (publica no próximo deploy) |
| CSP | ausente no HTML (só no `sw.js`) | Amarelo | CSP com nonce na fase backend |
| Conteúdo em produção | commit `c3ae05b`: `/` → 307 `/entrar`; `/demonstracao`, `/sitemap.xml`, `/robots.txt` → 404 | Amarelo | publicar os commits locais após aprovação |
| E-mail raiz | `MX 0 .` + `v=spf1 -all` + `DMARC p=reject` | Verde | domínio raiz não envia nem recebe e-mail (proteção contra falsificação) |
| Resend (`send.`) | MX/SPF para `send.forge.rmta.net`, DKIM `resend._domainkey` presente | Verde | verificar status “Verified” no painel Resend |
| Supabase | não criado | Cinza | fase 2 |
| R2 | não habilitado na conta | Cinza | habilitar quando houver backend |
| Credenciais compartilhadas na conversa | Gmail, Vercel, Resend, Supabase, Cloudflare, R2 | **Vermelho** | **rotacionar todas** (lista sem valores em `20-ITENS-DEPENDENTES-DO-PROPRIETARIO.md`) |
