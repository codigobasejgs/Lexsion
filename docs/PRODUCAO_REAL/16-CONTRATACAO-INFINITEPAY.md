# 16 — Contratação self-service e InfinitePay — 30/10/2026

## Estado: implementada, publicada e **DESLIGADA para venda**
Não há venda porque os preços ainda não foram aprovados pelo dono. Nenhuma cobrança real nem pagamento de teste foi feito.
Para ligar, são necessárias as duas travas:
1. No Super Admin → Planos, marcar **“Preço aprovado pelo proprietário”** nos planos que serão vendidos.
2. Na Vercel, a variável `SAAS_CHECKOUT_ENABLED=1`, que só o dono liga.

Sem as duas, `/planos` mostra “Valores em breve”, `/contratar` mostra que a venda não foi liberada e a API responde 503.

## Conta recebedora
| Item | Situação |
|---|---|
| InfiniteTag `$marco-boggian` | ✅ existe e tem o **Checkout Integrado habilitado**: `POST /links` respondeu HTTP 200 com o link `checkout.infinitepay.io/marco-boggian?...`, um único link de R$ 1,00 **não pago**, sem `valid_until`, que não deve ser pago |
| Página do checkout | mostra “Link integrado: $marco-boggian”; **não exibe razão social nem CNPJ** |
| CNPJ 59.760.458/0001-91 | ⚠️ **titularidade não verificável pela API**. A API não retorna CNPJ, e não tenho acesso à conta autenticada. O dono declarou que a tag é desta empresa (mensagem de 30/10). Para confirmar: no App InfinitePay → Perfil → dados da conta, ou pelo comprovante da 1ª venda real, que mostra razão social e CNPJ por exigência do Decreto 7.962/2013 |
| API Key (`inchk_…`) | ⛔ **não fornecida**. Funciona sem ela (só handle), mas sem a chave o link **não expira** e **aceita mais de um pagamento**. O sistema compensa: o pedido expira em 24 h no banco, e pagamento após a expiração ou em duplicidade **não ativa nada** e gera alerta. Recomendado: criar a chave (App → Configurações do Checkout → API Key) e pôr em `INFINITEPAY_API_KEY` na Vercel, só no servidor |

## O que a documentação oficial permite (lida em 30/10/2026)
- Links avulsos (`POST /links`) e consulta (`POST /payment_check`). **Não há** recorrência, estorno, cancelamento, sandbox nem split pela API.
- O webhook **não é assinado**, por isso todo aviso é conferido no `payment_check`.
- `amount` é o valor cobrado; `paid_amount` pode ser maior (juros do parcelamento).

## Fluxo implementado
1. **Landing → `/planos`:** planos lidos do banco (`saas_plans`). Recurso sem integração ativa aparece “(em breve)”.
2. **`/contratar`:** cadastro com validação no servidor (CPF/CNPJ com dígito verificador, e-mail, endereço único e não reservado), aceite da versão do contrato (`/termos#contratacao`, versão `2026-10-30`) e limite de 5 tentativas por hora por origem.
3. **`/api/contratar`:**
   - grava o pedido (`saas_orders`) com o **valor do banco** e um *snapshot* da versão do plano;
   - cria o link na InfinitePay e guarda a URL **antes** de qualquer outra coisa;
   - um cadastro repetido devolve o **mesmo** pedido e link;
   - se o link falhar, o pedido é cancelado e nada é cobrado.
4. **Confirmação:** webhook (`/api/infinitepay/webhook`), retorno do navegador (`/contratar/retorno`), rotina diária e botão do Super Admin, todos por `confirmOrder`.
   - consulta o `payment_check`;
   - confere `paid`, **valor**, pedido e **transação inédita**;
   - marca pago com um `UPDATE … where status='pendente'` (concorrência: um vence).
   - Falha de rede **nunca** vira pagamento; o webhook recebe 400 e a InfinitePay reenvia.
5. **Ativação (`saas_activate`, uma transação):** cria o escritório, o titular (convite do Supabase Auth para definir a senha), a assinatura com limite de usuários e o período, além do registro na auditoria e do e-mail de boas-vindas (Resend).
   - É idempotente.
   - Se falhar (ex.: endereço tomado depois do pagamento), o pedido fica **pago + ativação pendente**: alerta ao Super Admin, nova tentativa diária, botão “Reprocessar ativação”. **Ninguém é cobrado de novo.**
6. **Recorrência sem API de assinatura:** a rotina diária `lexsion-cobranca` (06:23 BRT):
   - emite o link do próximo período 7 dias antes e envia por e-mail;
   - marca o período como “vencida” no vencimento;
   - **suspende após 5 dias** (dados preservados);
   - reativa na hora quando o pagamento é confirmado;
   - expira pedidos não pagos e cancela ao fim do período, se o titular pediu.
7. **Estorno/cancelamento:** o aviso do provedor gera alerta. A marcação (pedido estornado e escritório suspenso) é feita no Super Admin depois de conferir na conta InfinitePay, que não tem API de consulta de estorno.

## Super Admin e titular
- **Super Admin** (`/admin/planos`, `/admin/faturamento`, em operação real):
  - edita nome, preço mensal/anual, usuários, teste grátis, recursos, visibilidade e aprovação, **sem código**;
  - mudar preço cria nova versão e não altera quem já contratou;
  - indicadores reais: MRR, assinaturas ativas, recebido, pagos sem ativação;
  - pedidos com reprocessar, conferir pagamento e registrar estorno, todos auditados.
- **Titular** (Configurações → Assinatura):
  - vê plano, preço contratado, vencimento, link da renovação em aberto e pagamentos com comprovante;
  - pede troca de plano (vale no próximo período, recusada se a equipe excede o limite);
  - cancela ou desfaz o cancelamento ao fim do período.
- **Isolamento:** RLS em `saas_*`. O titular só lê o que é do próprio escritório e ninguém escreve pelo navegador. Os avisos do provedor só a plataforma lê. O limite de usuários é aplicado por trigger no banco.

## Testes
- **Banco (PGlite):** `tests/db/contratacao.test.ts`, 10/10:
  - planos propostos não aprovados;
  - preço mínimo;
  - ativação única e idempotente;
  - pendente não ativa;
  - falha sem escritório pela metade;
  - só o servidor ativa;
  - limite de usuários;
  - renovação idempotente que reativa inadimplente;
  - RLS do titular, de terceiros e da plataforma.
- **Unidade:** `tests/unit/infinitepay.test.ts`, 5/5: pago, pendente, recusado, valor divergente, transação reaproveitada, pedido estornado ou expirado.
- **E2E:** `tests/e2e/contratacao.spec.ts`:
  - planos do banco sem “Contratar”;
  - `/contratar` e a API recusam com a venda desligada;
  - retorno com parâmetros forjados não confirma;
  - webhook de pedido alheio é ignorado e corpo inválido recebe 400;
  - termos publicados.

## Publicação (30/10/2026)
- **Versão:** `4739800`, com CI do GitHub **success**. Vercel em produção READY (`lexsion.com.br`).
- **Migrations aplicadas em produção** (dry-run antes, backup lógico antes): `20261030110000_backup_storage` e `20261030120000_contratacao_saas`.
- **Contra a produção:**
  - contratação: 10/10 (desktop e mobile);
  - QA-115, concorrência, governança, comercial, persistência e site: 61 passaram, 1 pulado;
  - smoke: 4/4.
- **Rotinas:**
  - `/api/cron/backup` em produção: `verified: true`, 1.600 linhas, 32 tabelas;
  - `/api/cron/cobranca`: `ok`, nada a cobrar (0 assinaturas);
  - sem segredo, a rotina de cobrança responde 401.
- **Estado do banco:** 0 pedidos, 0 assinaturas, 0 escritórios. Os planos estão como propostos e não aprovados.

## O que **não** foi comprovado (e não é declarado)
- **Pagamento real confirmado → escritório ativado em produção:** exige uma compra real (mínimo R$ 1,00; não há sandbox), que precisa de **autorização específica** do dono. Até lá, a contratação **não está operacional**.
- **Titularidade do CNPJ:** ver a tabela acima.
- **Texto dos termos:** escrito pelo time técnico, **pendente de revisão jurídica**.

## Para entrar em operação (ordem)
1. O dono aprova os preços no Super Admin (ou ajusta).
2. Cria a API Key e a coloca em `INFINITEPAY_API_KEY` na Vercel (recomendado).
3. Revisão jurídica dos termos de contratação.
4. **Autoriza uma compra real de teste** (ex.: plano temporário de R$ 1,00): pagar, ver a ativação, conferir o CNPJ no comprovante e estornar pelo App.
5. Liga `SAAS_CHECKOUT_ENABLED=1`.
