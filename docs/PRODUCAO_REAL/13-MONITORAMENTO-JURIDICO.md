# 13 — LexSion Intelligence: monitoramento jurídico (28/10/2026)

**Versão em produção:** `3b9f3d5` (Vercel READY em `lexsion.com.br`).
**Agendador:** um único agendador, o Supabase Cron (`pg_cron`), job `lexsion-inteligencia`, expressão `7 */3 * * *` (UTC): a cada 3 horas, no minuto 7. Ele chama por HTTP (`pg_net`) a rota protegida `/api/cron/inteligencia`. O segredo da chamada fica no Vault do Supabase e na Vercel, nunca no Git. A coleta é periódica, **não é tempo real**.

## Auditoria do que existia antes
| Item | Estado anterior | Agora |
|---|---|---|
| Jornal do Advogado | 2 amostras fixas da demonstração | **real** na operação (fontes oficiais); a demonstração mantém as amostras |
| Fontes jurídicas da minuta | cadastro manual de leis com link | inalterado (citação manual com fonte) |
| Notificações | coleção `notifications` (sino) | alerta jurídico entra no mesmo sino |
| Busca/RAG, cron, conectores | inexistentes | conector da Câmara, motor de sincronização, cron, busca textual em português |

## Matriz por fonte
| Fonte | Órgão | Informação coberta | Conector | Autorização | Estado | Frequência | Última coleta confirmada | Itens | Testes | Limitações / custo |
|---|---|---|---|---|---|---|---|---|---|---|
| Câmara — Dados Abertos | Câmara dos Deputados | PL, PLP, PEC, PDL e MPV com tramitação recente: ementa, situação, último ato, data de apresentação, link oficial | API REST pública `/api/v2/proposicoes` | dados abertos públicos | **REAL_ATIVA** | 3 h | ver "Execuções" abaixo | 152 documentos, 153 versões | INTEL-01/02 em produção | até 150 proposições por execução; sem inteiro teor no índice (link oficial); custo zero |
| Senado — Dados Abertos | Senado Federal | matérias atualizadas | — | dados abertos | PARCIAL | — | — | 0 | sondagem | a rede de teste recebeu HTTP 429; ativar após coleta comprovada a partir do servidor |
| Planalto — Legislação | Presidência | leis, decretos, MPs | — | público | INDISPONÍVEL | — | — | 0 | sondagem (sem resposta em 60 s) | não há API documentada; raspagem não é usada |
| LexML | Rede LexML | normas (metadados) | — | público | INDISPONÍVEL | — | — | 0 | sondagem | o serviço exige verificação anti-robô |
| DOU — INLABS | Imprensa Nacional | portarias, atos normativos | — | exige cadastro | AGUARDA_CREDENCIAL | — | — | 0 | sondagem (em manutenção) | precisa de login INLABS da LexSion |
| Previdência / INSS / CRPS | Ministério da Previdência | atos e notícias | — | público | INDISPONÍVEL | — | — | 0 | sondagem (RSS responde 404) | atos previdenciários chegam pelo DOU quando o INLABS for credenciado; CNIS e dados de segurado **nunca** por automação de login |
| DataJud | CNJ | processos (capa e movimentos) | — | **termo veda uso comercial** (itens 3.3 e 3.8) | AGUARDA_LICENCA | — | — | 0 | teste técnico só de contagem | precisa de autorização do CNJ ou parecer jurídico |
| Jurisprudência STF/STJ/TRFs/TJs/CJF | Tribunais | precedentes | — | sem API pública unificada para SaaS | AGUARDA_LICENCA | — | — | 0 | — | depende de fornecedor com contrato |
| Jusbrasil (API) | privado | jurisprudência, diários, processos | — | só por contrato de API | AGUARDA_LICENCA | — | — | 0 | — | as credenciais pessoais enviadas **não foram usadas** |
| Previdenciarista / IntelPrev / Cálculo Jurídico | privados | cálculos e conteúdo | — | sem API com sublicenciamento | AGUARDA_LICENCA | — | — | 0 | — | as credenciais pessoais enviadas **não foram usadas** |

## Resultados comprovados (Câmara, produção)
- **Primeira coleta:** em 28/10 às 16:39 (Brasília), o disparo manual da função do agendador percorreu `trigger_legal_sync` → `pg_net` → rota → API da Câmara e coletou 150 proposições com status `ok` em 60,9 s. A execução agendada sem intervenção foi verificada separadamente abaixo.
- **Sem duplicação:** 10 reexecuções (manuais, mesmo motor) leram as mesmas ~150 proposições e criaram só o que mudou na fonte: **2 proposições novas** e **1 alteração de tramitação**, que virou a versão 2 com histórico. Nenhuma atualização foi repetida (INTEL-01 compara as contagens antes e depois de cada execução).
- **Alertas:** em cada uma das 3 rodadas do teste, um escritório sintético novo escolheu uma área pela tela e recebeu **27 alertas reais** (81 no total), todos daquela área, cada um com uma notificação no sino. O escritório de controle recebeu 0. A execução seguinte gerou **0 alertas novos**. Os escritórios sintéticos e os alertas foram apagados.
- **Isolamento:** escritório B não lê alertas nem preferências de A. Ninguém grava documento jurídico pelo navegador. As execuções só aparecem para a plataforma. A rota do cron sem segredo responde 401.
- **Falha de fonte:** 5 execuções feitas a partir da máquina local (que não alcança a Câmara) foram registradas como `erro` ("Câmara inacessível"); o último dado íntegro continuou no ar e o painel mostrou o erro. Depois de 3 falhas seguidas, o circuito abre por 1 hora (o contador foi zerado depois do teste).
- **Rótulos:** "Projeto em tramitação" nunca aparece como "Norma em vigor". O detalhe avisa que o projeto não é lei e mostra a data de apresentação, o último ato oficial, a data da coleta e a última confirmação, cada uma separada.

## Execuções (painel Super Admin > Integrações)
Em 28/10/2026 às **18:07:03, horário de Brasília** (21:07 UTC), o job disparou pelo relógio, sem acionamento manual. `cron.job_run_details` registrou `succeeded`; a execução `source_sync_runs.id = 17` terminou `ok` às 18:07:52, com **150 itens lidos, 0 novos, 0 alterações e 0 alertas**. Dados anteriores permaneceram preservados.

## IA
A IA (Gemini) **não gera notícia nem jurisprudência**. No Jornal não há resumo por IA nesta versão: a ementa oficial é exibida como veio da fonte. A classificação por área usa regras de palavras, sem IA. O resumo por IA sobre o texto oficial, com citação, fica para a próxima fase, junto com inteiro teor e RAG.

## Pendências
1. Senado: ativar o conector depois de uma coleta comprovada a partir do servidor (limite de requisições).
2. DOU: credenciar o INLABS da LexSion; com ele entram os atos do Ministério da Previdência, INSS e CRPS.
3. DataJud: autorização do CNJ ou parecer jurídico. Jurisprudência: contrato com fornecedor.
4. E-mail diário (digest) e WhatsApp para alertas: o modelo de dados já guarda a preferência, mas o envio ainda não foi ativado. Hoje o alerta é só in-app.
5. Inteiro teor, RAG com citações e "anexar ao caso / gerar tarefa de revisão" a partir do alerta.
6. Plano Hobby da Vercel: a duração máxima da função limita cerca de 150 proposições por execução (~60 s).
