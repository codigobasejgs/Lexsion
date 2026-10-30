# 18 — Super Admin gerencial (operação real) — 30/10/2026

## Diagnóstico: por que o painel mostrava dados fictícios
- `src/app/admin/page.tsx` (antes) calculava os indicadores com `readAll("tenants")` e `readAll("saasInvoices")`, que no modo real vinham de `platform_records`/fixtures. O texto “calculados a partir dos dados fictícios da demonstração” aparecia **também no /admin real**.
- `src/app/admin/organizacoes/page.tsx` usava o repositório da demonstração (`tenantRepo`), com regravação da lista inteira. Isso permitia só suspender, reativar e trocar o plano, sem teste grátis, cortesia, histórico ou auditoria de antes/depois.

**Agora:** no modo real, o painel, os contratantes, a ficha e a auditoria leem **somente** o Supabase por funções da plataforma, que exigem papel e MFA (aal2). A demonstração continua igual, com a faixa “Ambiente demonstrativo · Dados fictícios” e um link para o Super Admin real. O /admin real mostra a faixa “Administração da plataforma · Dados reais” e o horário da leitura.

## O que foi implementado
| Requisito | Estado | Onde |
|---|---|---|
| Separar real × demo | **feito** | `admin/page.tsx`, `organizacoes/page.tsx`, `auditoria/page.tsx`, faixa em `admin/layout.tsx` |
| Painel real com período (7/30/90 dias) e fórmulas | **feito** | `platform_metrics`, `real-dashboard.tsx` |
| Lista de contratantes com filtros, busca, paginação, CSV, cards no celular | **feito** | `platform_orgs`, `real-orgs.tsx` |
| Ficha 360º (resumo, assinatura e concessões, titular e equipe, histórico) | **feito** | `platform_org_timeline`, `/admin/organizacoes/[id]` |
| Teste grátis: conceder, prorrogar (+3/7/15/30/n), definir data, reativar, encerrar | **feito** | `platform_trial` |
| Cortesia com validade (só o proprietário), sem receita | **feito** | `platform_courtesy` |
| Alterar plano (já ou na próxima renovação), sem cobrança automática | **feito** | `platform_set_plan` |
| Suspender, reativar (só com direito vigente), cancelar | **feito** | `platform_set_status` |
| Limite extra de usuários com validade | **feito** | `platform_override` + `memberships_quota` |
| Reenviar acesso ao titular | **feito** | `/api/admin/operacoes` (`invite`) |
| Expiração automática de teste/cortesia (rotina diária, idempotente) | **feito** | `saas_expire_access` no cron `lexsion-cobranca` |
| Avisos 7/3/1 dias antes do fim do teste (Resend, sem repetir) | **feito** | `/api/cron/cobranca` |
| Papéis internos: proprietário, operações, financeiro SaaS, suporte, auditor | **feito** | `platform_members.role`, `is_platform`, `platform_role` |
| Auditoria imutável com antes/depois, motivo e papel | **feito** | `audit_logs` (colunas novas), `/admin/auditoria` |
| Concorrência (dois admins) e duplo clique | **feito** | versão `updated_at` + chave de idempotência |
| Gestão de planos, contratos, financeiro SaaS | **já existia (real)** | `/admin/planos`, `/admin/contratos`, `/admin/faturamento` |
| Suporte por tickets reais | **parcial** | tela da demonstração; tickets reais em `platform_records` ainda não têm UI própria |
| Cupons e promoções | **não feito** | sem tabela de cupons; desconto hoje só por novo preço do plano |
| Transferência de titularidade | **não feito** | exige dupla revisão; não implementei para não abrir caminho de tomada de conta |
| Acesso assistido (suporte entrando no escritório) | **não feito, de propósito** | proibido sem autorização do escritório |
| Tela para criar usuários internos | **não feito** | papéis internos hoje via banco; a UI fica para depois |

## Fórmulas (função `platform_metrics`)
- **MRR:** soma do preço das assinaturas `ativa` que têm ao menos um pedido `pago` (conferido no payment_check); ciclo anual ÷ 12. **Teste e cortesia ficam fora.**
- **ARR** = MRR × 12. **ARPA** = MRR ÷ escritórios pagantes.
- **Recebido no período:** soma dos pedidos `pago` com `paid_at` no período.
- **Conversão teste → pago:** escritórios que já tiveram teste e têm pedido pago ÷ escritórios que já tiveram teste.
- **Suporte** não recebe valores: aparece “restrito”.
- **Visitas a /planos não são medidas:** não há ferramenta de análise instalada. O funil começa no contrato gerado.

## Testes
- **Banco** (`tests/db/super-admin.test.ts`, 14/14):
  - concessão de 14 dias, com fim às 23:59:59 de Brasília;
  - prorrogação +7 somada ao fim atual;
  - duplo clique não duplica;
  - dois administradores com a mesma versão: o segundo é recusado;
  - definir data e encerrar exigem motivo; dados preservados;
  - reativar e expirar (rotina idempotente);
  - cortesia só pelo proprietário e com MRR 0;
  - plano sem cobrança;
  - reativar sem direito é recusado;
  - limite extra aplicado e revogado no banco;
  - sem MFA nada funciona;
  - suporte não vê valores; financeiro, suporte e auditor não alteram;
  - titular e anônimo bloqueados;
  - histórico só-acréscimo;
  - a ficha não traz conteúdo jurídico.
- **E2E contra o Supabase real** (`tests/e2e/real-super-admin.spec.ts`, 8/8 em desktop e celular):
  - faixa “Dados reais”;
  - escritório do banco na lista;
  - concessão e prorrogação pela tela, conferidas no banco e no histórico;
  - cortesia sem pedido;
  - plano;
  - titular sem acesso.
  - `real-comercial` COM-04 também foi refeito pela ficha.

## Não testado / bloqueado
- **Pagamento real:** não autorizado. MRR com pagante real não foi comprovado em produção (só no banco de teste).
- **Avisos de fim de teste:** dependem de escritórios reais em teste; a lógica de não repetir foi revista, mas o envio real não foi observado.
