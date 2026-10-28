# 06 — Integrações: estado verdadeiro (28/10/2026)

| Provedor | Estado (Gate 3) | Prova | Falta |
|---|---|---|---|
| **Supabase Auth** | **LIVE (produção do projeto)** | login real recusando/aceitando (REAL-AUTH-01), convite e recuperação | rotação das chaves |
| **Supabase Postgres + RLS** | **LIVE** | 3 migrations aplicadas; 11 testes reais | backup testado; conectar telas |
| **Supabase Storage** | **LIVE** | upload na pasta do escritório, bloqueio cruzado, SVG recusado (teste real) | tela de documentos usar o bucket |
| **Resend** | **LIVE como SMTP do Auth**; envio direto aceito | e-mail de teste aceito (`delivered@resend.dev`, id registrado); SMTP configurado | **não confirmei a entrega do convite**: a chave é restrita a envio e não lê eventos. Conferir no painel Resend ou na caixa de entrada |
| Evolution (WhatsApp) | NOT_IMPLEMENTED (adaptador demo) | — | URL e chave da instância, decisão Baileys × Cloud API |
| Asaas / InfinitePay / Mercado Pago | IMPLEMENTED_WAITING_CREDENTIALS (contrato) | — | conta sandbox e chaves |
| ZapSign | IMPLEMENTED_WAITING_CREDENTIALS (contrato) | — | token sandbox |
| IA | NOT_IMPLEMENTED | — | provedor, contrato e política de dados |
| Índices (API CJ) | BLOCKED_LICENSE | doc pública lida | contratação |
| DataJud | BLOCKED_LICENSE | termos do CNJ restringem uso comercial | parecer jurídico |
| Jusbrasil | BLOCKED_LICENSE | doc não acessível (403) | contato comercial |
| Meta/Google Ads | NOT_IMPLEMENTED | — | OAuth da conta do escritório |
| Cloudflare / DNS | **não alterado** | — | — |
| Vercel | **não alterado** (sem deploy desta branch) | — | autorização + variáveis de ambiente do Supabase no projeto Vercel |
