# 05 — Fontes, APIs, licenças e custos

Leitura pública em 28/10/2026, sem login e sem uso das credenciais que apareceram na conversa. WebFetch/WebSearch deram erro 503, então as páginas foram baixadas por `curl`. Algumas páginas são aplicações de página única, e o conteúdo veio do JSON ou JS público delas. Nenhuma integração foi conectada.

| Fonte | O que é (verificado) | Autenticação | Custo/contratação | Cobre | NÃO cobre | Estado na LexSion |
|---|---|---|---|---|---|---|
| API de índices do Cálculo Jurídico (`calculojuridico.com.br/api-indices-docs/`) | Documentação técnica pública | Cabeçalho `X-CJ-API-KEY` | Chave por contato comercial. Sandbox limitado a 5 anos. Limite por plano (HTTP 429) | `/v1/list`, `/v1/index`, `/v1/daily_values`: índices de tribunais, compostos, IPCA/INPC/IGP, SELIC/TR/CDI, Lei 14.905, moedas antigas | Calculadoras, IA, CRM | `indexSourceAdapter` planejado. Chave só no servidor (fase 2) |
| DataJud CNJ (`datajud-wiki.cnj.jus.br/api-publica/`) | API pública de metadados | `Authorization: APIKey <chave pública>` (o CNJ pode trocar) | Gratuita | Capa e movimentações de processos públicos, por tribunal (`_search`) | Partes, inteiro teor, sigilosos | `legalDataAdapter` planejado. **Os termos proíbem uso comercial e revenda**: avaliar juridicamente antes de conectar |
| Jusbrasil Soluções API (`api.jusbrasil.com.br/docs`) | Não acessível (403, desafio anti-bot) | Não verificado | Não verificado | Não verificado | **Não presumir** API do agente Jus IA | Planejado, com nota explícita |
| Jus IA (`ia.jusbrasil.com.br`) | Não acessível (403) | — | — | — | — | Só referência de capacidade |
| Tramitação Inteligente | Páginas de produto e blog públicos. Área logada não auditável | — | — | Workflows visíveis (modelos e feriados) | — | Referência. Nenhum conteúdo copiado |
| Previdenciarista | Páginas de produto e venda | — | Teste de 30 dias da IA anunciado | — | — | Referência |
| IntelPrev | Aplicação de página única. Textos vêm do JS público (evidência fraca) | — | Planos anunciados na interface | — | — | Referência. Score próprio, com pesos documentados |
| Planalto (legislação) | Portal oficial | Nenhuma | Gratuito | Texto de leis | — | Links nas fontes semeadas (não verificadas até conferência humana) |
| OAB, Provimento 205/2021 | Página oficial confirmada (15/07/2021) | — | — | Publicidade da advocacia | Alterações posteriores não confirmadas | Regras de follow-up e campanhas citam o provimento. **Conferir a redação vigente antes de automatizar** |
| Evolution, Resend, Asaas, InfinitePay, Mercado Pago, ZapSign, Supabase, R2 | Contratos já existentes (`services/adapters.ts`) | Só no servidor | A contratar | — | — | `requires_credentials` ou `planned`. Nenhum ativo |
| Meta Ads, Google Ads | Contratos novos | OAuth da conta do escritório (servidor) | Conta do escritório | Leads e métricas | Disparo de campanha | Planejados |

Custos: só os anunciados publicamente estão citados. Os demais dependem de proposta comercial e **não foram estimados**.
