# 04 — Integrações: estado comprovado (28/10/2026)

| Provedor | Estado | Prova | Falta |
|---|---|---|---|
| Supabase Auth | **ATIVO** | login real, conta sem vínculo recusada (REAL-AUTH-01), 5 contas sintéticas logadas no E2E | rotação das chaves |
| Supabase Postgres + RLS | **ATIVO** | 38 testes de banco + 7 de integração real + 5 E2E reais | — |
| Supabase Storage | **ATIVO** | upload do portal gravado na pasta do pedido (REAL-ERP-04); bloqueio cruzado testado | — |
| Resend (SMTP do Auth) | **ATIVO para convites/recuperação** | envio aceito pelo provedor | **entrega na caixa não confirmada** (chave só de envio, sem leitura de eventos) |
| Vercel | **ATIVO** | variáveis de ambiente gravadas (nomes em `07`) e deploy de `main` | — |
| Evolution (WhatsApp) | BLOQUEADO | — | URL/chave da instância |
| Asaas / InfinitePay / Mercado Pago | BLOQUEADO | — | contas e chaves; segredo de webhook |
| ZapSign | BLOQUEADO | — | token |
| IA | BLOQUEADO | — | provedor + contrato LGPD |
| Índices oficiais, DataJud, Jusbrasil | BLOQUEADO (licença/parecer) | — | contratação/parecer |
| Meta/Google Ads | BLOQUEADO | — | OAuth das contas |
| Cloudflare/DNS | não alterado | — | — |

Nenhuma integração bloqueada simula resultado na operação.
