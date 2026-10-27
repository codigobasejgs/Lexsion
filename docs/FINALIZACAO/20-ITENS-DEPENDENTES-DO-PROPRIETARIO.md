# 20 — Itens que dependem do proprietário

## Urgente: rotação de credenciais (sem valores aqui)
Foram coladas na conversa de desenvolvimento e devem ser **revogadas e recriadas** pelo proprietário. Nenhuma foi gravada em arquivo, Git ou deploy.
| Serviço | Credencial | Onde trocar |
|---|---|---|
| Google (Gmail) | senha da conta | Conta Google → Segurança (ativar verificação em duas etapas) |
| Vercel | token de acesso | Vercel → Account Settings → Tokens |
| Resend | API key | Resend → API Keys |
| Supabase | chave secreta e segredo JWT | Supabase → Project Settings → API (projeto novo recomendado) |
| Cloudflare | tokens de API (2) | Cloudflare → My Profile → API Tokens |
| Cloudflare R2 | Access Key ID e Secret | R2 → Manage API Tokens |
| WhatsApp (conversa anterior) | senhas de terceiros citadas | cada serviço citado |

## Decisões e insumos
| Item | Para quê | Onde entra |
|---|---|---|
| Preços e condições dos planos | página `/planos` hoje sem preço | `content/marketing.ts`, Super Admin → Planos |
| Termos de uso e política de privacidade definitivos | páginas `/termos`, `/privacidade` (provisórias) | revisão jurídica |
| Contatos oficiais (e-mail, WhatsApp, endereço, CNPJ) | rodapé, `/contato` | `content/marketing.ts` |
| Provedor de pagamento (Asaas, InfinitePay ou Mercado Pago) | honorários e assinatura SaaS | fase 2 |
| Assinatura eletrônica (ZapSign) e transporte do WhatsApp (Evolution: Baileys × Cloud API) | integrações | fase 2 |
| Material dos livros da autora | Academia | aguardando |
| Validação de regras previdenciárias, cálculos e triagem | resultados hoje são exemplos | domínio jurídico |
| Calendário de feriados por tribunal | prazos | Configurações → Feriados |
| Autorização para publicar (push/deploy) | ver `16-PLANO-PUBLICACAO.md` | — |
| Teste em aparelhos reais (iPhone/Android) | PWA | — |
| Domínios próprios por escritório | white-label | DNS + fase 2 |
