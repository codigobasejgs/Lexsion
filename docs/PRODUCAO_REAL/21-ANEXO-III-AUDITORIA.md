# 21 — Anexo III (DPA) 2026.11-1: texto para validação e auditoria técnica — 03/11/2026

**Status: NÃO PUBLICADO.** O texto mantém marcas “[PENDENTE: …]” onde a afirmação não pôde ser comprovada. O banco (trigger `saas_ctv_guard`, migration `20261030170000`) recusa aprovar ou publicar qualquer versão com “[PENDENTE”.

## 1. Auditoria de cada afirmação (evidência coletada em 03/11/2026)

| # | Afirmação | Evidência | Resultado |
|---|---|---|---|
| A1 | Supabase: banco, autenticação e arquivos | código (`src/lib/supabase/*`), projeto ativo `ACTIVE_HEALTHY` | **comprovado** |
| A2 | Supabase na região us-east-1 | Management API do projeto: `"region":"us-east-1"` | **comprovado** (só para o Supabase) |
| A3 | Vercel: hospedagem/funções em iad1 (EUA) | API Vercel do projeto: `functionDefaultRegions: ["iad1"]`; deployment `regions: ["iad1"]`; DNS `lexsion.com.br` → 76.76.21.21 (Vercel) | **comprovado** |
| A4 | Cloudflare R2: cópias de segurança | `src/lib/backup.ts`; bucket com `location: "ENAM"` (América do Norte oriental), `jurisdiction: "default"` | **comprovado**; “ENAM” é indicação de localização, não garantia contratual do provedor |
| A5 | Resend: e-mails transacionais | `src/app/api/contrato/route.ts` e demais envios | **finalidade comprovada; região NÃO verificada** (a chave atual é restrita e não lê a configuração do domínio) |
| A6 | InfinitePay: pagamentos | `src/lib/infinitepay.ts`; envia nome, e-mail, valor e pedido | **finalidade comprovada; papel (operador ou controlador independente) e localização NÃO verificados** |
| A7 | Google Gemini: IA, só se ativada | `src/app/api/ia/route.ts` (modelo `gemini-2.5-flash`, exige consentimento do titular) | **finalidade comprovada; uso dos dados pelo Google para melhorar produtos depende do tipo de conta da API e NÃO foi verificado** |
| A8 | WhatsApp via Evolution API, só se ativado | `src/lib/evolution.ts`; o servidor Evolution fica em domínio de terceiro (não é da LexSion) e é compartilhado | **finalidade comprovada; operador e localização do servidor NÃO identificados** |
| A9 | “AES-256-GCM” | `src/lib/backup.ts` linhas 39/46: `createCipheriv("aes-256-gcm")` aplicado **pela aplicação só às cópias de segurança** antes do envio ao R2 | **comprovado só para os backups**. O banco e os arquivos principais (incluindo os PDFs de contrato) **não** têm criptografia da aplicação; dependem da criptografia do Supabase (não auditada aqui) |
| A10 | “Rotação de 30 dias” | `KEEP = 30` em `src/lib/backup.ts`: mantém os **30 manifestos diários mais recentes** e apaga os mais antigos **após cada backup novo conferido** | **redação anterior estava errada**. Não é rotação de chave (a chave de backup é fixa, sem rotação) e não é “30 dias” exatos: se o backup diário falhar, as cópias antigas ficam mais tempo. Corrigido no texto |
| A11 | Retenção de 90 dias após o encerramento | `/termos` promete preservar 90 dias. Não há nenhuma rotina que apague dados por expiração ou cancelamento | **preservação: compatível** (nada é apagado). **Eliminação após 90 dias: NÃO existe mecanismo**; hoje seria manual |
| A12 | Exportação pela plataforma | Configurações → LGPD → “Exportar dados do escritório (JSON)”: no modo real lê o banco, mas cobre só 8 coleções, **sem os arquivos**, e o arquivo sai rotulado “exportacao-demo / Dados fictícios” (defeito de rótulo) | **parcial**. Defeito de rótulo a corrigir |
| A13 | Administração da plataforma não lê conteúdo jurídico | RLS de `org_records` (`record_readable`) e do bucket `documentos` não incluem `is_platform`; teste `tests/db/super-admin.test.ts` (“ficha não traz conteúdo jurídico”) | **comprovado para as funções da plataforma**. A chave de serviço (servidor/banco) acessa tudo tecnicamente: isso é declarado no texto, não escondido |
| A14 | HTTPS/TLS | resposta de `https://lexsion.com.br`: `strict-transport-security: max-age=63072000` | **comprovado** |
| A15 | Auditoria imutável | `audit_logs`; aceites e auditoria contratual com trigger só-acréscimo (`saas_append_only`) | **comprovado** |
| A16 | Procedimento de incidentes | nenhum documento ou rotina encontrada | **inexistente** → pendente |
| A17 | Mecanismo de transferência internacional (art. 33 LGPD) | não verificado nos termos dos fornecedores | **pendente de validação jurídica** |
| A18 | Aviso de troca de suboperador | sem automação; seria compromisso manual | **compromisso novo**: precisa da sua confirmação |

## 2. Texto integral proposto — Anexo III, versão 2026.11-1

ANEXO III — ACORDO DE TRATAMENTO DE DADOS PESSOAIS

III.1. Papéis. Nos dados pessoais que a CONTRATANTE insere ou recebe pela plataforma (clientes, partes, representantes, dependentes, usuários da equipe, processos e documentos), a CONTRATANTE é controladora e a CONTRATADA é operadora (cláusula 10.1). Nos dados cadastrais, de contratação e de faturamento da própria CONTRATANTE, a CONTRATADA é controladora (cláusula 10.2).

III.2. Objeto e finalidade. A CONTRATADA trata esses dados somente para prestar o serviço contratado: armazenar, organizar, exibir, processar e transmitir os dados conforme as funções usadas pela CONTRATANTE, gerar cópias de segurança e manter registros de segurança e de auditoria.

III.3. Titulares e categorias de dados. Titulares: clientes e partes atendidos pela CONTRATANTE, seus representantes e dependentes, e os usuários da equipe da CONTRATANTE. Categorias: dados de identificação, contato e endereço; dados processuais; documentos e anotações inseridos pela CONTRATANTE; registros de acesso e de auditoria. A CONTRATANTE pode inserir dados pessoais sensíveis (por exemplo, de saúde), dados de crianças e adolescentes e dados relativos a processos criminais, sob sua responsabilidade como controladora e com a base legal aplicável.

III.4. Instruções do controlador. Este contrato e as configurações feitas pela CONTRATANTE na plataforma constituem as instruções documentadas da controladora. A CONTRATADA não trata os dados para finalidade própria e não os utiliza para treinar modelos de inteligência artificial próprios. As funções que enviam dados a terceiros (inteligência artificial e WhatsApp) só operam depois de ativadas pela CONTRATANTE.

III.5. Confidencialidade e acesso. As funções de administração da plataforma (comerciais, de suporte e de faturamento) não exibem o conteúdo jurídico dos escritórios, como documentos, processos e cadastros de clientes. O acesso técnico direto à infraestrutura (banco de dados e chaves de serviço) permite, tecnicamente, acesso a todos os dados e é usado somente para manutenção, segurança, cópias de segurança e cumprimento de obrigação legal, sujeito a dever de sigilo. [PENDENTE: identificar quem detém o acesso técnico direto e formalizar o compromisso de sigilo de quem atua pela CONTRATADA.]

III.6. Medidas de segurança. A CONTRATADA mantém as seguintes medidas, efetivamente implementadas na data desta versão: (a) isolamento dos dados por escritório no banco, por políticas de acesso por linha; (b) controle de acesso por papéis e permissões; (c) autenticação por credenciais individuais, com controle de sessões; (d) tráfego cifrado por HTTPS/TLS; (e) cópia de segurança diária do banco e dos arquivos, cifrada pela própria aplicação com AES-256-GCM antes do envio a provedor distinto e conferida após o envio; (f) registros de auditoria das ações administrativas e dos aceites contratuais, estes sem possibilidade de alteração. A criptografia do armazenamento principal (banco e arquivos) é a fornecida pela infraestrutura do provedor, sem camada adicional da aplicação.

III.7. Suboperadores. Participam do tratamento, na data desta versão:
(a) Supabase — banco de dados, autenticação e armazenamento de arquivos; todos os dados da plataforma; Estados Unidos (região us-east-1).
(b) Vercel — hospedagem e execução da aplicação; dados em trânsito nas requisições e registros técnicos de acesso; Estados Unidos (região iad1).
(c) Cloudflare (R2) — guarda das cópias de segurança, recebidas já cifradas pela aplicação; América do Norte.
(d) Resend — envio de e-mails transacionais (códigos de aceite, convites, avisos e cobranças); nome, e-mail e conteúdo das mensagens. [PENDENTE: confirmar a localização do tratamento.]
(e) InfinitePay (CloudWalk) — pagamento das assinaturas; nome e e-mail do titular, valor e identificação do pedido. [PENDENTE: confirmar se atua como suboperadora ou como controladora independente dos dados de pagamento, e a localização.]
(f) Google (API Gemini), somente se a CONTRATANTE ativar a inteligência artificial — geração de sugestões; trechos de texto enviados pelo usuário. [PENDENTE: confirmar o tipo de conta da API e se o conteúdo pode ser usado pelo Google para melhorar seus produtos; confirmar a localização.]
(g) Evolution API e WhatsApp, somente se a CONTRATANTE ativar o WhatsApp — envio e recebimento de mensagens; número, nome e conteúdo das mensagens. [PENDENTE: identificar o operador e a localização do servidor da Evolution API.]

III.8. Alteração de suboperadores. A inclusão ou substituição de suboperador que trate dados da CONTRATANTE será comunicada ao e-mail do titular antes de entrar em uso, salvo necessidade urgente de segurança, caso em que a comunicação ocorrerá logo em seguida.

III.9. Transferência internacional. O uso de suboperadores nos Estados Unidos e em infraestrutura global caracteriza transferência internacional de dados (art. 33 da LGPD), necessária à execução deste contrato. [PENDENTE: indicar o mecanismo do art. 33 adotado (por exemplo, cláusulas-padrão contratuais da ANPD) e conferir se os termos de cada fornecedor o contemplam.]

III.10. Incidentes de segurança. A CONTRATADA comunicará à CONTRATANTE, pelo e-mail do titular, o incidente de segurança que possa acarretar risco ou dano relevante aos titulares, sem demora indevida após tomar conhecimento, com as informações disponíveis, para que a CONTRATANTE, como controladora, avalie a comunicação à ANPD e aos titulares. [PENDENTE: definir o prazo e o procedimento interno de resposta a incidentes.]

III.11. Direitos dos titulares. Pedidos de titulares recebidos pela CONTRATADA sobre dados controlados pela CONTRATANTE serão encaminhados à CONTRATANTE. A plataforma permite à CONTRATANTE consultar, corrigir e excluir registros e registrar pedidos de eliminação. [PENDENTE: a exportação pela plataforma não inclui os arquivos; completar a exportação ou prever o envio pelo canal {{contratada.contato}}.]

III.12. Retenção, devolução e eliminação. Encerrado o contrato, os dados ficam preservados por 90 (noventa) dias, prazo em que a CONTRATANTE pode solicitar a exportação pelo canal {{contratada.contato}} ou reativar a assinatura. Depois desse prazo, os dados podem ser eliminados, salvo obrigação legal de guarda ou exercício regular de direitos. Os dados eliminados do ambiente principal permanecem nas cópias de segurança cifradas até a substituição destas: são mantidas as 30 (trinta) cópias diárias mais recentes, e as mais antigas são apagadas automaticamente após cada nova cópia conferida. [PENDENTE: não há rotina automática de eliminação após os 90 dias; definir o procedimento de eliminação.]

III.13. Término do tratamento. Encerrado o contrato, a CONTRATADA deixa de tratar os dados, exceto para a guarda prevista no item III.12, o cumprimento de obrigação legal ou o exercício regular de direitos.

## 3. Redação aprovada pelo proprietário para as cláusulas 6.1 e 14.1 (sem TOTP)

“A plataforma utiliza autenticação por credenciais individuais, controle de sessões e mecanismos de autorização baseados em papéis e permissões. O acesso aos dados é segregado por escritório, com controles de segurança e registros de auditoria, conforme os recursos efetivamente implementados e disponibilizados na plataforma.”

## 4. O que fecha cada pendência
| Pendência | Quem resolve | Como |
|---|---|---|
| III.5 acesso técnico/sigilo | proprietário | dizer quem tem as chaves; termo de sigilo |
| III.7(d) Resend | proprietário | painel Resend → Domains → região (ou chave com leitura) |
| III.7(e) InfinitePay | advogado(a) | papel nos dados de pagamento; termos da CloudWalk |
| III.7(f) Gemini | proprietário | tipo de conta (gratuita ou paga) no Google AI Studio |
| III.7(g) Evolution | proprietário | quem opera o servidor e onde está |
| III.9 transferência | advogado(a) | mecanismo do art. 33 |
| III.10 incidentes | proprietário + advogado(a) | prazo e procedimento |
| III.11 exportação | técnico | incluir arquivos na exportação (posso implementar) |
| III.12 eliminação | técnico + proprietário | rotina de eliminação após 90 dias (posso implementar, com aviso prévio) |
