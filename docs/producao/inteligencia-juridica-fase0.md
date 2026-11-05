# Inteligência Jurídica e Cálculos: Fase 0 (auditoria) e plano

Data: 05/11/2026. Base: código em `main`, banco de produção e requisitos do prompt de 05/11 (áudios da advogada Ir Simone).

## O que já existia
| Recurso | Onde | Estado real |
|---|---|---|
| Upload de documentos ao Storage privado `documentos/{escritório}/{arquivo}/…`, com RLS por escritório e portal | `docService.upload`, `services/real/backend.ts`, migração `registros_operacionais` | **Real**, testado (`supabase-rls.real`, E2E `real-erp`) |
| Documento com campo `extraction` (campo, valor, página, trecho) | `DocumentItem` em `types.ts` | **Só na demonstração**. Nada extrai de arquivo real ("análise automática depende da próxima fase") |
| Análise previdenciária (`pensionAnalyses`): linha do tempo, vínculos, pendências, cenários, relatório | `/app/previdenciario/analises/[id]` | **Demonstração**. Vínculos e cenários vêm de fixtures; resultado "exemplo demonstrativo"; não é possível criar análise no modo real |
| Diagnóstico de CNIS (lacuna, concomitância, abaixo do mínimo, sem data de fim) | `src/domain/cnis.ts` + `cnis-panel` | **Lógica real e testada** (`tests/unit/cnis.test.ts`), mas alimentada só por fixtures |
| Análise especializada PPP e BPC | `/app/previdenciario/especializadas/[id]` | **Demonstração**. BPC per capita é aritmética real; PPP é questionário fixo |
| Central de cálculos | `src/domain/calc-engine.ts` | Aritmética determinística em centavos; **nenhum modelo VALIDADO**; data-base `DEMO_TODAY` mesmo no modo real |
| Pesquisa de jurisprudência | `/app/pesquisa` | **Bloqueada** no modo real (sem base licenciada) |
| IA (Gemini) | `api/ia`, assistente, simulador | Ligada, **sem créditos (HTTP 402)**; faturamento pago **não confirmado** |
| Monitoramento legislativo (Câmara e Senado) | `/app/jornal` | **Real** (coleta a cada 3 h) |

## Decisões (04–05/11)
- **Leitura de PDF com texto:** `pdfjs-dist` (Apache-2.0) no servidor. Custo zero e nada sai da infraestrutura. Cobre o CNIS baixado do Meu INSS e a CTPS Digital.
- **OCR de imagem/escaneado:** pelo Gemini, decisão do proprietário em 05/11. **Bloqueado até** o projeto Google ter faturamento ativo confirmado (o prompt proíbe enviar documento confidencial antes disso; hoje a API responde 402). Enquanto isso, a tela informa "documento sem texto: OCR indisponível" e não inventa nada.
- **Regras jurídicas:** implementadas com fonte oficial e vigência, marcadas como **"aguarda validação"** até a Ir Simone aprovar a versão no sistema, sobre casos de referência.
- **Aritmética:** só código determinístico e versionado. A IA nunca calcula.

## Plano
**Fase 1 (esta entrega):**
1. Análise previdenciária **real** criada a partir do cliente.
2. Leitura de CNIS e CTPS Digital em PDF com evidência por campo (documento, página, trecho, confiança).
3. Revisão humana dos vínculos extraídos.
4. Comparação CNIS × CTPS.
5. Linha do tempo e pendências pelo motor `cnis.ts` existente.
6. Tempo de contribuição e motor de conversão de tempo especial parametrizado por vigência (até 13/11/2019 × depois).
7. Quadro de possibilidades por benefício com requisitos (atendido, pendente ou não verificável).
8. Checklist técnico de PPP com as classificações do prompt.
9. Roteiro de auxílio-acidente separado dos benefícios por incapacidade.
10. Relatório em PDF.

**Fase 2:** cálculo de RMI e cenários com salários de contribuição, índices oficiais versionados e regras de transição completas da EC 103 (art. 15 a 21).

**Fase 3:** pesquisa de jurisprudência com fonte verificável (DataJud para metadados; inteiro teor só de fontes oficiais com link) e geração de peças. Depende da IA paga confirmada.

**Fase 4:** motores trabalhista, cível e de liquidação.

## Limites desta versão
- Não acessa o Meu INSS nem altera o CNIS, e nunca pede a senha gov.br.
- O leiaute do CNIS muda entre versões do extrato: o leitor reconhece as linhas de vínculo pelo padrão (sequência, NIT, CNPJ/CEI, datas). Linha não reconhecida aparece como "não lida", nunca como vínculo inventado.

## Fase 1 entregue (05/11/2026)
| Item | Onde | Prova |
|---|---|---|
| Área "Inteligência Jurídica" (menu, lista, nova análise ligada ao cliente/caso) | `/app/inteligencia`, coleção `assessments` (`kind: "intel"`), RLS existente | E2E `real-juridica` JUR-01 |
| Leitura de CNIS, CTPS Digital e PPP em PDF com texto, no servidor, sem IA | `api/inteligencia/extrair`, `lib/pdf-text.ts`, `domain/pension/cnis-parser.ts`, `readers.ts` | unit `pdf-text`, `pension-intel`, `pension-readers`; E2E JUR-01 |
| Evidência por campo (documento, página, trecho, confiança) e status de revisão | `analysis.ts` (`Bond.evidence`, `status`) | unit `pension-analysis` |
| Revisão humana: confirmar, corrigir (guarda o valor lido), descartar, incluir manual | aba Vínculos | E2E JUR-01 |
| Comparação CNIS × CTPS | `compareCnisCtps` | unit |
| Linha do tempo, pendências, carência (desconta abaixo do mínimo), indicadores do CNIS | abas Linha do tempo e Pendências | unit |
| Conversão de tempo especial por vigência (só até 13/11/2019; fator por atividade e sexo) | `rules.ts` `convertSpecial` | unit |
| Checklist técnico do PPP com as 6 classificações (ruído por época, categoria até 28/04/1995, químicos/LINACH, EPI, responsável técnico) | `assessPpp` | unit |
| Possibilidades por benefício (atendido, pendente, não verificável) | `assessBenefits` | unit |
| Auxílio-acidente separado da incapacidade | `assessAccidentAid`, aba própria | unit |
| Relatório técnico em PDF (gerado no aparelho) | `report-pdf.ts` | E2E JUR-01 (PDF válido) |
| Isolamento entre escritórios; PDF sem texto não é inventado | rota com sessão do usuário + RLS | E2E JUR-02 |

Regras: versão `prev-2026.11-1`, **aguardando validação** da advogada responsável. OCR: bloqueado (Gemini sem faturamento confirmado), a tela diz isso.
Fora desta fase: RMI e transições completas (fase 2), jurisprudência (fase 3), cálculos trabalhista/cível/penal (fase 4).
