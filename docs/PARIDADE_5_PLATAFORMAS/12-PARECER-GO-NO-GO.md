# 12 — Parecer GO / NO-GO para iniciar o backend

**Decisão: GO COM RESSALVAS** para iniciar a fase 2 (Supabase), sem publicar esta branch antes da revisão do proprietário.

## Critérios (seção 18 do pedido)
| Critério | Situação | Evidência |
|---|---|---|
| Capacidades públicas e da cliente mapeadas, cada uma com uma saída definida | ✅ 71 capacidades classificadas | `01-MATRIZ-CAPACIDADES.csv` |
| Fluxos críticos testados (criar, editar, navegar, revisar, aprovar, exportar, vincular ao caso, isolar tenants) | ✅ | 289 E2E PASS, 142 unitários (1 opcional), 103/103 rotas |
| Nada dependente de servidor vendido como disponível | ✅ | adaptadores `planned`/`demo`, teste "nenhum ativo/real" |
| Cálculos separados em validado × simulado | ✅ nenhum VALIDADO; status por modelo | `04-…`, unit `calc-engine` |
| Prazos sujeitos a revisão | ✅ | contagem rotulada como demonstrativa |
| Contratos e mocks prontos para troca | ✅ | `11-…`, `services/adapters.ts` |
| Zero P0/P1 aberto; regressão aprovada | ✅ 2 intermitências de teste corrigidas | `10-…` |
| PWA, demo, ajuda e tours atualizados | ✅ 4 artigos e 5 prints novos; PWA intocado | `09-…` |
| Sem exposição de segredo | ✅ | nenhum segredo nos diffs |

## Ressalvas (por que não é GO pleno)
1. **Credenciais expostas** em conversas anteriores ainda não foram rotacionadas: ação do proprietário, **antes** de criar o projeto Supabase.
2. **Validação jurídica** pendente para RMI, carência, regras de transição, liquidação, critérios do BPC e enquadramento de atividade especial. Até lá, esses resultados ficam ilustrativos.
3. **Índices oficiais**: dependem de contratar uma fonte (por exemplo, a API de índices CJ) ou de alimentação manual com proveniência.
4. **DataJud**: os termos restringem uso comercial. É preciso análise jurídica antes de conectar.
5. Firefox, WebKit, aparelhos físicos, Lighthouse e leitor de tela **não executados** neste ambiente.
6. Esta branch (`paridade-5-plataformas`) **não foi publicada**. Precisa de revisão visual do proprietário e autorização para merge.

## NO-GO automático (nenhum ocorreu)
Apagar dados da demo sem aviso · quebrar CRM, processos, financeiro ou PWA · expor segredo · cálculo fictício apresentado como verdadeiro · integração ativa sem API · fluxo crítico sem teste.
