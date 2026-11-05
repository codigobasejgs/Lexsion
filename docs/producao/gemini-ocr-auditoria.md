# Gemini OCR: auditoria e preparação para produção (06/11/2026)

Situação: **pronto e bloqueado**. Nenhuma despesa foi gerada. Nenhum `generateContent` real foi chamado. Faturamento e limites de cobrança do Google não foram alterados.

## 1. Diagnóstico da integração
| Item | Achado |
|---|---|
| Projeto/chave | Uma chave da plataforma (`GEMINI_API_KEY`, só no servidor/Vercel), mais a chave opcional de cada escritório (cifrada AES-256-GCM em `org_credentials`). A chave é válida: `models.list` respondeu, com 61 modelos. O número do projeto não aparece pela API da chave; confirmar em aistudio.google.com → API keys. |
| Faturamento | **Não confirmado.** Em 04/11 a geração respondeu HTTP 402 ("prepayment credits are depleted"). A auditoria usou só endpoints gratuitos (`models.list`, `countTokens`). |
| Modelo configurado | `gemini-2.5-flash` (texto: atendimento, simulador, assistente). OCR novo: `gemini-2.5-flash-lite`. |
| Endpoint | `generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent` (Gemini API, não Vertex). |
| Chamadas de teste existentes | `ai_usage` vazio em produção: nenhuma chamada paga registrada. O teste de chave (`testCredential`) gera 1 token. |
| Chamadas que geram custo | (1) atendimento WhatsApp `runJob`; (2) simulador `/api/ia/simulador`; (3) assistente `/api/ia`; (4) teste de chave (1 token); (5) **novo** OCR `/api/inteligencia/extrair` com `ocr: true`. |
| OCR / extração / análise | **Extração estruturada é determinística** (parsers de CNIS, CTPS e PPP, sem IA). O OCR do Gemini só transcreve páginas sem texto. A análise jurídica (regras, RMI, PPP) não usa IA. |

## 2. Modelo recomendado: `gemini-2.5-flash-lite`
- **Tarefa:** transcrição fiel de página. Não precisa de raciocínio. `thinkingBudget: 0` e `temperature: 0`.
- **Preço oficial** (ai.google.dev/gemini-api/docs/pricing, conferido em 05/11/2026), por 1 milhão de tokens:

  | Modelo | Entrada | Saída |
  |---|---|---|
  | 2.5 Flash-Lite | US$ 0,10 | US$ 0,40 |
  | 3.1 Flash-Lite | US$ 0,25 | US$ 1,50 |
  | 2.5 Flash | US$ 0,30 | US$ 2,50 |
  | 2.5 Pro | US$ 1,25 | US$ 10,00 |

- Os modelos avançados ficam reservados: nenhuma rota usa Pro.
- Trocar o modelo: variável `GEMINI_OCR_MODEL`. O preço precisa existir em `ai_prices`.

## 3. Custo medido sem gastar (`countTokens`, gratuito)
- **Entrada medida:** 369 tokens por página = 258 (página do PDF, valor da documentação) + 111 (instrução). O valor foi igual para as páginas de CNIS, CTPS e PPP sintéticas.
- **Saída:** não dá para medir sem gerar, o que tem custo. Estimativa: de 600 a 1.200 tokens por página densa.
- **Custo estimado por página (Flash-Lite):**
  - entrada: 369 × 0,10 / 10⁶ = US$ 0,000037;
  - saída: até 1.200 × 0,40 / 10⁶ = US$ 0,00048;
  - total: **≈ US$ 0,0005 por página** (≈ R$ 0,003). Um CNIS escaneado de 10 páginas sai por ≈ US$ 0,005.
- **Custo real:** só no piloto autorizado. A tela grava os tokens devolvidos pelo Google (`usageMetadata`) e calcula o custo pelo preço em `ai_prices`.

## 4. Arquitetura de controle financeiro (aplicada no banco)
- **`ai_reserve` (atômica, com trava):** chamada antes de qualquer envio. Confere, nesta ordem:
  1. OCR ligado e faturamento confirmado;
  2. teto mensal em US$ da plataforma, contando as reservas;
  3. páginas por dia e por mês do escritório, com prioridade: exceção do escritório, depois plano, depois plataforma;
  4. páginas por mês da plataforma.
- **`ai_settle`:** acerto com os tokens reais. Em falha, custo 0 e páginas liberadas. Não acerta duas vezes.
- **`ai_platform_ok`:** o teto vale também para atendimento, simulador e assistente com a chave da plataforma.
- **Chave do escritório:** o custo é do escritório (`key_owner`). Não consome o teto da plataforma, mas segue os limites de páginas.
- **Cache:** `ocr_cache` por escritório + SHA-256 do arquivo + versão (`ocr-v1`). Documento idêntico não é cobrado de novo.
- **Texto nativo primeiro:** o pdfjs lê de graça. Só as páginas com menos de 40 caracteres vão ao OCR. Foto (JPG/PNG) vira PDF de uma página.
- **Consentimento na tela:** "Ler com IA" informa a quantidade de páginas. Sem `ocr: true`, nada é enviado.
- **Painel** (Super Admin, em Financeiro da plataforma):
  - consumo do mês, projeção, teto e alerta (80%, ajustável);
  - páginas, tokens e chamadas (indicando as estimadas), cache e falhas;
  - consumo diário (30 dias), por módulo, por modelo e por escritório;
  - limites editáveis, preços oficiais e custo apurado da fatura (conciliação manual).
- **Alterações no painel:** só superadmin, todas auditadas.
- **Limites iniciais (proposta):**

  | Escopo | Teto | Páginas por dia | Páginas por mês |
  |---|---|---|---|
  | Plataforma | US$ 5/mês | 300 | 3.000 |
  | Plano Solo | — | 20 | 100 |
  | Plano Profissional | — | 50 | 300 |
  | Plano Elite | — | 150 | 1.000 |

  O teto da plataforma não pode ficar vazio.

## 5. Segurança e LGPD
- **Termos do Google** (ai.google.dev/gemini-api/terms, lidos em 05/11/2026):
  - **Unpaid Services:** o conteúdo é usado para melhorar produtos, pode passar por revisão humana e há a instrução "não envie informação sensível".
  - **Paid Services**, que exigem projeto com conta de faturamento **ativa**: o conteúdo **não** é usado para treino e é tratado conforme o *Data Processing Addendum*. Há registro temporário só para coibir abuso.
- **Garantia técnica:** o OCR só é liberado depois que o Super Admin **confirma** o faturamento ativo, com evidência registrada na auditoria. Sem essa confirmação, o banco recusa a reserva.
- **Multi-tenant:**
  - o documento é localizado com a sessão do usuário (RLS de `org_records` e do Storage);
  - `ocr_cache`, `ai_settings` e as funções de reserva ficam inacessíveis ao navegador;
  - cada escritório vê só o próprio `ai_usage`.
- **Logs:**
  - `ai_usage` guarda só números, o id do documento e a versão;
  - `audit_logs` registra quem pediu o OCR, de qual documento, quantas páginas e com qual modelo;
  - nenhum conteúdo ou dado pessoal vai para log.
- **Revisão humana:** os vínculos lidos por IA vêm marcados "lida por IA, conferir no documento" e continuam começando como "aguardando revisão".

## 6. Testes executados
- **Banco** (`tests/db/ia-custos.test.ts`, 7/7):
  - bloqueio padrão;
  - limites por escritório e por dia;
  - acerto pelo preço oficial;
  - falha que não cobra;
  - teto em US$;
  - chave do escritório fora do teto;
  - 6 reservas concorrentes sobre limite 3 resultando em exatamente 3;
  - RLS.
- **Real** (`tests/real/ocr.real.test.ts`, 3/3, Supabase de produção com provedor **simulado** local):
  - bloqueado não envia;
  - só as páginas sem texto vão ao provedor;
  - tokens e custo registrados;
  - cache sem novo envio;
  - limite diário;
  - falha sem custo.
- **E2E real** (`real-ia-custos`, `real-juridica` JUR-05):
  - o painel mostra "Bloqueada";
  - confirmar exige evidência;
  - ligar e retirar ficam auditados;
  - o teto vazio é recusado;
  - o PDF escaneado pede confirmação e, bloqueado, não gera registro de uso.
- **Correções encontradas pelos testes:**
  - o pdfjs esvaziava o buffer usado depois pelo OCR (passou a ler uma cópia);
  - um erro de banco na reserva aparecia como "provedor" (agora interrompe sem chamar o Google).

## 7. Pronto × depende de autorização
**Pronto (no código e no banco, desligado):** leitura seletiva, cache, reserva/acerto, limites, painel, auditoria, consentimento na tela e marcação "lida por IA".

**Depende do proprietário:**
1. Ativar o faturamento no projeto Google da chave da plataforma. Recomendo também um alerta de orçamento no Google Cloud Billing, por exemplo US$ 10.
2. Confirmar no painel: Financeiro da plataforma → "Confirmar faturamento" (com evidência) → "Ligar OCR".
3. Aprovar os limites por plano (proposta acima) e o teto mensal da plataforma.
4. Fornecer documentos autorizados para o piloto (CNIS, CTPS e PPP escaneados, com consentimento do titular) para medir precisão, saída real e custo efetivo.
