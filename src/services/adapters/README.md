# Adapters

Hoje só existe o adapter **mock** (`src/services/mock/*`), que grava no IndexedDB do navegador.

Para produção, cada provedor ganha um adapter **no servidor** (Route Handler/Server Action) que implementa a interface de `src/services/contracts.ts`:

| Interface | Provedor previsto | Onde roda |
|---|---|---|
| `PaymentProvider` | Asaas, InfinitePay, Mercado Pago (adapters separados) | Servidor; webhook verificado conforme cada provedor |
| `MessagingProvider` | Evolution API | Servidor; sessão da Evolution em infraestrutura própria (não função efêmera da Vercel) |
| `EmailProvider` | Resend | Servidor |
| `SignatureProvider` | ZapSign | Servidor |
| `LegalDataProvider` | DataJud e fontes autorizadas | Jobs assíncronos |
| `AIProvider` | A definir | Servidor, com limites por escritório |
| `StorageProvider` | Supabase Storage (bucket privado, URL temporária) | Servidor |
| `AdvertisingProvider` | Meta/Google Ads (OAuth) | Servidor |

Regras: nenhuma chave em `NEXT_PUBLIC_*`, bundle ou storage do navegador; idempotência por chave; eventos deduplicados e persistidos antes de processar; reconciliação antes de reenviar após timeout.
