# Inteligência Jurídica: fases 2, 3 e 4 (05/11/2026)

## Fontes oficiais (sem custo, sem raspagem)
| Dado | Fonte | Como chega | Atualização |
|---|---|---|---|
| INPC, IPCA, IPCA-E, IGP-M, IGP-DI, Selic, TR, taxa legal, salário mínimo | Banco Central, SGS (API pública) | `src/domain/tables/official.json` (gerado por `scripts/tabelas-oficiais.mjs`) + tabela `official_series` | Diária (`lexsion-fontes-oficiais`, 07:37) |
| IPC-r (jul/1994 a jun/1995) | IBGE SIDRA, tabela 86 | arquivo versionado | Série encerrada |
| Tábua completa de mortalidade 2024 | IBGE (FTP oficial) | arquivo versionado | Anual: rodar o script quando sair a nova |
| Teto do salário de contribuição | INSS (gov.br) | arquivo versionado, com o ato | Anual |
| Precedentes qualificados (temas, IAC, PUIL, SIRDR, controvérsias) | STJ, dados abertos (CC-BY) | tabela `legal_precedents` (2.369 registros) | Diária, grava só o que mudou |

Teto: 2012 a 2021 e 2026 conferidos na página do INSS (`verified: true`). 1994 a 2011 e 2022 a 2025 estão marcados "conferir número no DOU". Os valores são públicos, mas o número da portaria não foi conferido.

## Fase 2: RMI e planejamento (`src/domain/pension/rmi.ts`, versão `rmi-2026.11-1`)
- **Salários de contribuição:**
  - de 07/1994 em diante, limitados ao teto do mês;
  - atualizados pelo índice legal de cada época: IPC-r, depois INPC, depois IGP-DI, depois INPC (Dec. 3.048, art. 33);
  - competência abaixo do mínimo depois de 13/11/2019 sai da média e do tempo (CF, art. 195, §14).
- **Regras:**
  - EC 103: arts. 15 (pontos), 16 (idade progressiva), 17 (pedágio de 50% com fator previdenciário; inatingível com menos de 28/33 anos em 13/11/2019), 18 (idade), 19 (permanente) e 20 (pedágio de 100%);
  - LC 142: pessoa com deficiência, por tempo (grave, moderada e leve) e por idade.
- **Cálculo:**
  - média de 100%, com descarte (art. 26, §6º) só enquanto mantém o tempo mínimo e a carência e aumenta a RMI;
  - coeficiente de 60% + 2% por ano;
  - fator previdenciário pela fórmula legal, com a tábua do IBGE;
  - resultado limitado entre o mínimo e o teto.
- **Planejamento:**
  - data de cumprimento de cada regra;
  - RMI na data;
  - contribuições até lá (tabela progressiva 2026 ou alíquota fixa; 5% e 11% só dão direito a aposentadoria por idade);
  - quanto deixa de receber ao esperar, aumento mensal e retorno do investimento;
  - valor até a expectativa de vida (IBGE, por sexo).
- **Outros benefícios:** auxílio por incapacidade temporária (91%, limitado à média dos 12 últimos salários), aposentadoria por incapacidade permanente (comum ou acidentária), auxílio-acidente (50%) e pensão por morte (cotas).
- **Tela:** aba "Planejamento e RMI" na análise. A mesma informação entra no relatório PDF.
- **Simplificações declaradas na memória de cálculo:**
  - o descarte retira 30 dias de tempo por competência;
  - valores futuros ficam em moeda de hoje.

## Fase 3: jurisprudência verificável
- Na operação real, a Pesquisa jurídica busca nos precedentes do STJ: texto em português ou número do tema, com filtro por área.
- Cada resultado mostra a situação, a tese e o link "Abrir no STJ".
- "Copiar citação" só aparece para precedente com tese firmada e não cancelado.
- A tela de Pesquisa foi desbloqueada.
- A IA não gera precedente.
- Inteiro teor de acórdãos e DataJud continuam fora: o DataJud exige chave e respondeu 401.

## Fase 4: cálculos (`src/domain/calc-official.ts`)
- **Atualização de débito judicial:**
  - correção por IPCA-E, IPCA, INPC ou IGP-M até o marco;
  - depois do marco, só Selic (sem somar outro índice) ou juros de 1% ao mês;
  - multa e honorários.
- **Rescisão completa (CLT):**
  - aviso proporcional com projeção;
  - regra dos 15 dias;
  - férias vencidas e 1/3;
  - multa de 40% (20% no acordo);
  - INSS de 2026.
- **Horas extras com reflexos:** DSR, 13º, férias + 1/3 e FGTS.
- **Pensão alimentícia em atraso:** salário mínimo de cada mês e índice oficial.
- **Dosimetria (art. 68 do CP):** três fases, com o limite da Súmula 231.
- **Progressão de regime (art. 112 da LEP):** frações da Lei 13.964/2019 e remição.
- Todos marcados "Aguarda revisão jurídica".

## Testes
- Unitários: 253, incluindo:
  - motor de RMI, com contas conferidas à mão;
  - cálculos;
  - tabelas.
- Banco: RLS das tabelas novas e agendamento.
- Real:
  - coleta do STJ no Supabase de produção (2.369 registros; segunda execução idempotente);
  - cobertura do backup.
- Coleta do BCB comprovada em produção em 05/11/2026: a rotina diária gravou 216 valores das 9 séries (INPC/IPCA/IPCA-E/IGP-DI até 09/2026; IGP-M até 10/2026; Selic, TR, taxa legal e salário mínimo até 11/2026). A API recusa "ultimos/N" acima de 20; a coleta usa intervalo de datas.
- E2E real: JUR-01 a JUR-04, no computador e no celular:
  - leitura do CNIS;
  - planejamento com salários;
  - pesquisa STJ com link oficial;
  - cálculo com IPCA-E oficial.

## Pendências externas
- Validação das versões `prev-2026.11-1`, `rmi-2026.11-1` e `calc-2026.11-1` pela advogada responsável, sobre casos de referência.
- OCR de documento escaneado: depende do faturamento do Gemini.
- Inteiro teor e jurisprudência dos TRFs/TNU: depende de chave do DataJud ou de licença.
