# 13 — Segurança, LGPD e riscos

## Verificado nesta fase
| Controle | Resultado | Evidência |
|---|---|---|
| Segredos no repositório (árvore e histórico) | 0 ocorrências de padrões de chave (Resend, Supabase secret, GitHub, AWS/R2, JWT longo, chave privada) | varredura `git log -p --all` |
| `NEXT_PUBLIC_*` com segredo | nenhum; só `NEXT_PUBLIC_SUPABASE_URL`/chave publicável com `REPLACE_ME` | `.env.example` |
| Dependências | `pnpm audit` (prod e completo): sem vulnerabilidades conhecidas | execução em 27/10/2026 |
| Injeção em DOCX/e-mail/CSV | escapado; fórmulas CSV neutralizadas | unit `docx`, `email-templates`; E2E DOC-07, SEC-03 |
| Upload de logo | magic bytes, SVG recusado, reencode | QA-050/058 |
| Prévia de e-mail | `iframe sandbox` sem scripts | WL-EMAIL-01 |
| Login | não guarda senha, tempo de resposta constante (não revela conta) | QA-LOGIN-01 |
| Cabeçalhos | DENY, nosniff, Referrer-Policy, Permissions-Policy | `next.config.ts` |
| Dados | todos fictícios; `noindex` em app/demo | QA-LANDING-05 |

## LGPD (frontend)
Exportação JSON do escritório, registro de pedido de eliminação com revisão de retenção, aviso de ambiente demonstrativo, sem rastreadores de terceiros. Política de privacidade e termos: publicados como "versão provisória" até revisão jurídica do proprietário.

## Riscos abertos
| Risco | Severidade | Mitigação |
|---|---|---|
| Credenciais reais foram coladas na conversa de desenvolvimento | Alta | rotacionar todas (proprietário) |
| Autorização apenas visual | Alta se usado com dado real | não usar com dado real; RLS na fase 2 |
| Sem CSP completa | Média | nonce na fase 2 |
| Dados da demo só no navegador | Baixa (demo) | aviso persistente; exportação JSON |
