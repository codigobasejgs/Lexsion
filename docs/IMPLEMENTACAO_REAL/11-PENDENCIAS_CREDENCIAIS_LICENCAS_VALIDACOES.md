# 11 — Pendências: credenciais, licenças e validações

## Rotacionar (comprometidas por terem sido coladas em conversa)
| Serviço | Variável/credencial | Onde |
|---|---|---|
| Supabase | `SUPABASE_SECRET_KEY`, Legacy JWT secret, `SUPABASE_ACCESS_TOKEN` | Project Settings → API Keys / JWT; Account → Access Tokens |
| Resend | `RESEND_API_KEY` (atualizar também o SMTP do Auth) | Resend → API Keys; Supabase → Auth → SMTP |
| Vercel | token de acesso | Vercel → Account → Tokens |
| Cloudflare | tokens de API | My Profile → API Tokens |
| Google | senha da conta `lexsionadvogacia@gmail.com` | Conta Google → Segurança (ativar 2 etapas) |

Depois de rotacionar: gravar os novos valores em `.env.local` **pelo terminal** (sem colar no chat) e, para o deploy, nas variáveis do projeto Vercel.

## Variáveis necessárias (só nomes)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (servidor), `SUPABASE_ACCESS_TOKEN` e `SUPABASE_PROJECT_REF` (só operador, para migrations), `RESEND_API_KEY`, `APP_MODE`.
Futuras: `EVOLUTION_URL`, `EVOLUTION_API_KEY`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_SECRET`, `ZAPSIGN_TOKEN`, `CJ_API_KEY`.

## Ações do proprietário
1. Abrir o e-mail de convite em `lexsionadvogacia@gmail.com` e definir a senha (link vence em 24 h; se vencer, eu reenvio).
2. Conferir no painel Resend se o convite foi entregue (a chave atual não permite consultar).
3. Conferir backups no painel Supabase (plano atual) — restauração ainda não testada.
4. Autorizar (ou não) publicar a branch: a Vercel precisa das variáveis do Supabase antes.

## Validações jurídicas e licenças (inalteradas)
Ver `docs/PARIDADE_5_PLATAFORMAS/02-…` e `05-…`: RMI, carência, regras de transição, BPC, atividade especial, índices oficiais, DataJud, Jusbrasil.
