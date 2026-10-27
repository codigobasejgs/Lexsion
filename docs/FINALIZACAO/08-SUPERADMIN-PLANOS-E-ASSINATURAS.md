# 08 — Super Admin, planos e assinaturas

| Tela | Rota | O que faz |
|---|---|---|
| Painel geral | `/admin` | MRR, ARR, ARPA, churn, testes a vencer, suspensos, faturas em aberto — todos calculados dos dados (`domain/saas-metrics.ts`) |
| Contratantes | `/admin/organizacoes` | busca/filtro, wizard de 5 etapas (slug validado, nomes reservados), suspender com motivo obrigatório, reativar preservando dados, trocar plano |
| Planos e assinaturas | `/admin/planos` | cotas e preços **demonstrativos** (não publicados) |
| Financeiro da plataforma | `/admin/faturamento` | faturas SaaS; simulação de webhook (pago, falha, estorno, reenvio idempotente) |
| Integrações | `/admin/integracoes` | estado honesto de cada provedor; nenhum “ativo” |
| Suporte | `/admin/suporte` | chamados com SLA e notas internas |
| Auditoria | `/admin/auditoria` | toda ação da plataforma registrada |

## Separação de cobranças
- **Assinatura LexSion** (plataforma → escritório): `saasInvoices`, provedores da plataforma.
- **Honorários** (escritório → cliente final): `installments/payments/charges` de cada escritório.
Indicadores do painel nunca somam honorários (QA-165/166). O escritório vê a própria assinatura só para leitura (QA-RBAC-06).

## Limites
Preços e cotas são exemplos editáveis; nenhum valor foi publicado no site. Cobrança real, prorrata e emissão fiscal dependem de gateway e backend.
