# 10 — Manual do operador e suporte

## Primeiro acesso do dono (Super Admin)
1. `lexsion.com.br/entrar` → "Sou do escritório" → e-mail do dono e a senha definida. Vai para `/admin`.
2. **Contratantes → Novo escritório**: nome, endereço (slug), responsável (nome e e-mail), plano. O responsável recebe o convite por e-mail.
3. O responsável abre o link, define a senha (≥ 10, letras e números) e entra; o escritório começa vazio.

## Dentro do escritório
- **Equipe → Convidar membro**: nome, e-mail e perfil. Só titular/gestor convida; só o titular concede "titular".
- **Clientes, casos, tarefas, agenda, prazos, documentos, minutas, CRM, propostas, contratos, financeiro (baixa manual)**: operam no banco real.
- **Portal do cliente**: na ficha do cliente, **Liberar portal** (advogado(a), gestor ou titular) envia o convite. O cliente entra em “Sou cliente”, vê só o que foi liberado, envia documentos pedidos e manda dúvidas.
- Áreas com "Integração pendente" não fazem nada até o provedor ser credenciado (ver `08`).

## Suporte (operador técnico)
| Tarefa | Como |
|---|---|
| Aplicar migration nova | `pnpm db:migrate:dry` e depois `pnpm db:migrate` |
| Backup / teste de restauração | `06` |
| Suspender / reativar escritório | Super Admin → Contratantes (motivo obrigatório, auditado) |
| Ver auditoria | Super Admin → Auditoria (plataforma) · titular: dados do escritório |
| Reenviar convite expirado (24 h) | convidar de novo pela mesma tela |

## Rotação de credenciais (obrigatória — foram coladas em conversa)
Supabase (secret key, JWT secret, access token), Resend (e atualizar SMTP do Auth), Vercel, Cloudflare, senha do Gmail do dono (ativar 2 etapas).
Depois: atualizar `.env.local` pelo terminal e as variáveis da Vercel; redeploy.

## Contas de teste
`qa-sem-vinculo@lexsion-qa.invalid` (fixa, sem vínculo). Os testes E2E criam e apagam pessoas/escritórios `qa-…`; nunca usam dados de clientes.
