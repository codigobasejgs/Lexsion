# 11 — Relatório final da auditoria operacional (28/10/2026)

**Versão em produção:** commit `0bc50bd` em `main` · deploy Vercel `READY`, alias `lexsion.com.br` e `www.lexsion.com.br` (conferido pela API da Vercel).
**Banco:** Supabase `lexsion`, 8 migrations aditivas, 16/16 tabelas com RLS.
**Método:** cada linha "✅" tem teste automatizado que grava no banco real, sai, entra de novo e confere na tela e no banco. Contas e escritórios de teste são sintéticos (`qa-…@lexsion-qa.invalid`) e são apagados ao final. Após a última rodada, o banco tem 0 escritórios, 0 registros, 0 arquivos e 0 vínculos; restam só o dono e o QA fixo.

Legenda: ✅ comprovado em produção · 🟡 funciona, com ressalva · ⛔ bloqueado (sem simulação) · — não se aplica

## Tabela por módulo

| Módulo | Funcionalidade | Frontend | Backend | Banco | Integração externa | Teste | Evidência | Pendência |
|---|---|---|---|---|---|---|---|---|
| Acesso | Login por convite, sessão em cookie, destino pelo vínculo | ✅ | Server Action | `my_access` | Supabase Auth ✅ | REAL-AUTH-01, todos REAL-* | conta sem vínculo é recusada e deslogada | MFA do Super Admin (B14) |
| Acesso | Recuperação de senha | ✅ | Auth | — | Supabase Auth ✅ · Resend 🟡 | REC-01 | nova senha vale, a antiga não, o link é de uso único, o token sai da URL | entrega na caixa não confirmável com a chave atual (B11) |
| Acesso | Cadastro público | fechado | — | — | — | config | `disable_signup` | — |
| Segurança | Isolamento entre escritórios | ✅ | RLS | 16/16 tabelas | — | 40 de banco, 11 de integração, REAL-ERP-02 | outro escritório lê 0 linhas e a gravação é recusada; com RLS desligada, 6 testes falham | — |
| Segurança | Papéis (financeiro, estagiário, correspondente, sigiloso) | ✅ | RLS + triggers | `collection_policies` | — | db, REAL-ERP-03, PERS-02 | estagiário não aprova; financeiro não vê o CRM | — |
| Segurança | Escritório suspenso perde o acesso | ✅ | função | `set_organization_status` | — | db, SA-01 | suspensão com motivo auditado | — |
| Clientes | Cadastro, duplicidade por CPF, ficha | ✅ | `org_records` | ✅ | — | REAL-ERP-01, PERS-01 | persiste após sair e entrar; responsável real | — |
| Casos / processos | Abrir caso, fases, sigilo | ✅ | `org_records` | ✅ | — | PERS-01 | autor real na auditoria | captura automática de andamentos (DataJud ⛔) |
| Tarefas e agenda | Criar, concluir, recorrência, compromisso | ✅ | `org_records` | ✅ | — | PERS-01, db (recorrência) | persistem após sair e entrar | — |
| Prazos e publicações | Cadastro manual, tarefa a partir de intimação | 🟡 | `org_records` | ✅ | diário/DataJud ⛔ | db | gravação sob RLS | leitura automática (licença/IA) |
| Documentos | Envio da equipe, Storage privado, visualização | ✅ | Storage + `org_records` | ✅ | Supabase Storage ✅ | PERS-03 | arquivo em `<escritório>/…`, link temporário, reabre após entrar de novo | extração automática (OCR/IA ⛔) |
| Minutas e modelos | Edição, versões, aprovação por advogado(a) | ✅ | trigger de aprovação | ✅ | — | db, REAL-ERP-03 | campo não preenchido bloqueia a aprovação | — |
| CRM | Lead, funil, conversão, follow-up registrado | ✅ | `org_records` | ✅ | anúncios ⛔ | PERS-02 | persiste; financeiro não acessa | captura por campanha/UTM (B7) |
| Propostas e contratos | Proposta, aceite registrado, contrato com assinatura registrada | 🟡 | `org_records` + trigger | ✅ | ZapSign ⛔ | db (aprovação) | registro manual explícito, sem assinatura simulada | assinatura eletrônica (B4) |
| Financeiro do escritório | Parcelas, baixa manual, despesas, conciliação manual | ✅ | `org_records` | ✅ (centavos inteiros) | — | PERS-02 | despesa de R$ 123,45 gravada como 12345 | — |
| Cobranças online | Pix/boleto/cartão | ⛔ | — | — | Asaas/InfinitePay/MP ⛔ | REAL-ERP-05 | tela bloqueada, nenhuma cobrança emitida | credenciais (B2) |
| Portal do cliente | Ver casos, enviar documento pedido, dúvida → tarefa, liberação pela ficha | ✅ | RPC `portal_*` | ✅ | Storage ✅ · Auth ✅ | REAL-ERP-04, REAL-ERP-06 | cliente não vê notas internas nem documentos não liberados | pagamentos no portal (B2) |
| Equipe | Convite real com perfil | ✅ | API do servidor + RLS | ✅ | Auth/Resend ✅ | convites.real (4) | só titular/gestor convida | — |
| Super Admin | Criar escritório real + convite ao titular | ✅ | API + `create_organization` | ✅ | Auth ✅ | SA-01 | escritório nasce vazio, sem dado de demonstração | — |
| Super Admin | Plano, suspensão, auditoria, consumo agregado | ✅ | funções da plataforma | ✅ | — | db, SA-01 | motivo auditado; contagens sem conteúdo | — |
| Super Admin | Faturamento da assinatura | ⛔ | — | `platform_records` | pagamento ⛔ | — | aviso "não ativo" | provedor da plataforma (B3) |
| White-label | Nome, cores, logotipo por escritório | ✅ | titular grava; ícone no bucket `marcas` | ✅ | Storage público só de marca | WL-01, db | advogado(a) não altera a marca; outro escritório não é afetado | — |
| PWA | Manifesto e ícone próprios por escritório (ERP e portal) | ✅ | rota `/pwa/{erp,portal}-<slug>` + `public_brand` | ✅ | — | WL-01, unitários | escritório real responde 200 (antes 404), ids distintos, inexistente responde 404 | isolamento total de instalação exige subdomínio por escritório (DNS) |
| Demonstração | `/demonstracao` isolada | ✅ | IndexedDB local | nunca no servidor | — | DEMO-ISO-01 + 301 E2E | após sessão real na mesma aba, a demo não grava nada no banco | — |
| Cálculos jurídicos | Previdenciário, trabalhista, cível, bancário, penal | 🟡 | `org_records` | ✅ | índices oficiais ⛔ | unitários + E2E | gravam e reabrem; marcados como demonstrativos | validação por advogado(a) (B10) e índices (licença) |
| IA jurídica | Assistentes, chat, leitura de documentos | ⛔ | — | — | sem provedor | REAL-ERP-05 (padrão de bloqueio) | tela bloqueada | provedor + contrato LGPD (B5) |
| WhatsApp | Atendimento, automações | ⛔ | — | — | Evolution ⛔ | — | tela bloqueada | URL/chave da instância (B1) |
| Tribunais | DataJud, Jusbrasil, jurisprudência | ⛔ | — | — | licença ⛔ | — | sem conector | parecer/licença (B9) |
| Backup | Backup lógico e restauração isolada | ✅ | scripts | — | — | executado 2× | RESTAURACAO_OK (16 tabelas, RLS e arquivos) | PITR do provedor desligado (B13) |

## Integrações: evidência de operação real

| Provedor | Estado | Evidência | Falta |
|---|---|---|---|
| Supabase Auth / Postgres / Storage | **Operacional** | todas as suítes reais em `lexsion.com.br` | rotação de chaves |
| Resend | **Operacional para envio** | domínio com DKIM, SPF e DMARC (`p=reject`) publicados; API aceita o envio (HTTP 200 com id) | chave só de envio: a entrega na caixa não é verificável pela API. Confirmar no painel |
| Vercel | **Operacional** | deploy `0bc50bd` READY nos aliases de produção | — |
| Evolution (WhatsApp) | **Bloqueado** | nenhuma credencial no ambiente | URL e chave da instância |
| Asaas / InfinitePay / Mercado Pago | **Bloqueado** | nenhuma credencial | conta, chave, segredo de webhook (e conta da plataforma para a assinatura) |
| ZapSign | **Bloqueado** | nenhuma credencial | token + webhook |
| IA jurídica | **Bloqueado** | nenhum provedor contratado | provedor, contrato de tratamento de dados (LGPD), limites |
| Cálculos | **Operacional sem validação jurídica** | testes unitários e E2E | homologação profissional + índices oficiais licenciados |
| DataJud / Jusbrasil / índices CJ | **Bloqueado** | — | parecer sobre os termos do CNJ; contratação comercial |

## Defeitos achados e corrigidos nesta rodada

| ID | Gravidade | Defeito | Correção |
|---|---|---|---|
| PR-06 | P1 | Manifesto PWA de escritório real respondia 404 (só a demo tinha) | `public_brand` + rota consulta o banco; teste WL-01 |
| PR-07 | P2 | Logotipo de escritório real ficaria embutido no banco e o manifesto não teria ícone próprio | publicação em bucket público só de marca, com escrita restrita ao titular |
| PR-08 | P2 | App do portal instalado abriria o login no perfil errado | `/entrar?perfil=cliente` pré-seleciona "Sou cliente" |
| PR-09 | P3 | QR "Meu aplicativo" apontava para a rota da demo | aponta para o login do escritório |

## Percentual operacional comprovado

**Módulos do ERP (tabela acima, 29 linhas):**

| Estado | Linhas | Percentual |
|---|---|---|
| ✅ comprovadas em produção | 21 | 72% |
| 🟡 com ressalva | 3 | 10% |
| ⛔ bloqueadas | 5 | 17% |

**Matriz de paridade (71 capacidades frente às 5 plataformas de referência, `01-…csv`):**

| Estado | Capacidades | Percentual |
|---|---|---|
| Operacional pleno | 17 | 24% |
| Operacional, sem validação jurídica | 32 | 45% |
| Parcial (entrada manual) | 9 | 13% |
| Bloqueado | 11 | 15% |
| Não implementado (conector MCP, extensão Meu INSS) | 2 | 3% |

Ou seja, **69% funcionam sobre dados reais** e **24% sem nenhuma ressalva**. A maior parte da diferença está nos cálculos e análises jurídicas: rodam e gravam, mas não podem ser usados como parecer até a revisão por advogado(a).

## Parecer de prontidão comercial

**Pronta para piloto comercial pago com escritórios selecionados**, em operação de gestão: cadastros, casos, prazos manuais, documentos, minutas, CRM, propostas e contratos com registro manual, financeiro com baixa manual, portal do cliente, equipe, white-label e PWA.

**Não pronta para venda ampla** enquanto não houver:
1. Rotação das credenciais.
2. MFA no Super Admin e PITR.
3. Pelo menos um provedor de pagamento, para a assinatura e para os honorários.
4. Validação jurídica dos cálculos.
5. Assinatura eletrônica e WhatsApp, se forem argumentos de venda.

Não declaro a plataforma 100% funcional: 5 módulos e 11 capacidades dependem de terceiros, e 32 capacidades aguardam homologação jurídica.
