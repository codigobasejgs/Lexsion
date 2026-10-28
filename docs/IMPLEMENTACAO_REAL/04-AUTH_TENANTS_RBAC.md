# 04 — Autenticação, escritórios e papéis

## Configuração aplicada no Supabase Auth (28/10/2026)
| Item | Antes | Agora |
|---|---|---|
| Cadastro público | aberto | **fechado** (só convite) |
| Senha mínima | 6 | 10 (tela exige letras e números) |
| `site_url` | localhost | `https://lexsion.com.br` (+ localhost para desenvolvimento) |
| Reautenticação para trocar senha | não | sim |
| SMTP | padrão Supabase (limitado) | Resend (`nao-responda@lexsion.com.br`) |
| Templates convite/recuperação | padrão | PT-BR, link `token_hash` para `/redefinir-senha` |

## Fluxos implementados
- **Login** `/entrar`: Server Action `signInAction` → `signInWithPassword`; sessão em cookies httpOnly (`@supabase/ssr`); destino pelo vínculo real (`/admin`, `/app/inicio`, `/portal`); conta sem vínculo é **deslogada** e avisada. Mensagem única para erro (anti-enumeração).
- **Recuperar acesso** `/recuperar-acesso`: `resetPasswordForEmail`; resposta igual exista ou não a conta.
- **Definir/redefinir senha** `/redefinir-senha`: aceita `token_hash` (convite/recuperação) ou `code`; remove o token da barra de endereço.
- **Renovação de sessão**: `src/proxy.ts` (só quando há cookie `sb-…`).
- **Convite de equipe**: `POST /api/equipe/convites` — confere titular/gestor com a sessão do pedinte; convite pelo Auth Admin no servidor; vínculo gravado sob RLS.

## Contas existentes no projeto
| Conta | Papel | Situação |
|---|---|---|
| `lexsionadvogacia@gmail.com` | `superadmin` (plataforma) | **convite enviado** em 28/10 13:59 (SMTP Resend). Aguarda o dono abrir o e-mail e definir a senha |
| `qa-sem-vinculo@lexsion-qa.invalid` | nenhum | usuário de QA para o teste de login real (domínio que não recebe e-mail) |

## O que ainda NÃO usa a sessão real
As telas internas (`/app`, `/portal`, `/admin`) continuam lendo a **sessão demonstrativa** (`src/components/providers.tsx`). O dono consegue autenticar, mas ainda não opera o ERP com os dados do banco: ver `12-…`, Gate 2.
