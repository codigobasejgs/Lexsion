# 12 — Relatório de prontidão comercial (28/10/2026)

**Versão em produção:** commit `544e413` · deploy Vercel `READY` nos aliases `lexsion.com.br` e `lexsion.vercel.app` (conferido pela API da Vercel).
**Prova em produção:** 17/17 testes reais em `lexsion.com.br`, com escritórios e pessoas sintéticos, apagados depois. Banco após a rodada: 0 escritórios, 0 registros, 0 arquivos, 0 instâncias de WhatsApp, 0 registros de uso de IA. Instâncias `lexsion-*` na Evolution: 0.

## Por módulo

| Módulo | Implementado | Operação real comprovada | Testes | Problemas corrigidos | Dependência externa | Versão |
|---|---|---|---|---|---|---|
| Login e convites | convite por e-mail, sessão em cookie, destino pelo vínculo | conta sem vínculo é recusada | REAL-AUTH-01, convites (4) | — | — | `544e413` |
| Recuperação de senha | link de uso único, nova senha | a antiga deixa de valer, o link não se reutiliza | REC-01 (local e produção) | — | entrega na caixa não verificável pela chave atual do Resend | `544e413` |
| Isolamento e permissões | RLS em todas as tabelas, papéis no banco | outro escritório lê 0 e não grava; estagiário não aprova | 42 de banco, 11 de integração, REAL-ERP-02/03 | — | — | `544e413` |
| Suspensão | motivo obrigatório, auditado | equipe e portal perdem o acesso; dados preservados | db, SA-01 | — | — | `544e413` |
| Persistência | clientes, casos, tarefas, agenda, CRM, financeiro, documentos | conferidos após sair e entrar, na tela e no banco | PERS-01/02/03 | — | — | `544e413` |
| Armazenamento privado | documentos em `<escritório>/…` | arquivo no Storage, não no banco; link temporário | PERS-03, REAL-ERP-04 | — | — | `544e413` |
| Demonstração × produção | demo só no navegador | após sessão real na mesma aba, a demo não grava no banco | DEMO-ISO-01 | — | — | `544e413` |
| Super Admin | criar escritório + convite, plano, suspensão, auditoria, consumo | escritório nasce vazio; suspensão auditada | SA-01 | — | — | `544e413` |
| White-label | nome, cores, logotipo por escritório | só o titular altera; outro escritório não é afetado | WL-01 | logotipo agora publicado como arquivo de marca | — | `544e413` |
| PWA por escritório | manifesto ERP + portal por escritório real | 200 para escritório real, 404 para inexistente, ids distintos | WL-01, unitários | manifesto de escritório real dava 404 | separação de instalação total exige subdomínio (DNS) | `544e413` |
| **WhatsApp (Evolution)** | QR por escritório, estado, envio da equipe, webhook de entrada | QR real gerado; webhook grava mensagem uma vez e ignora outra instância; envio recusado sem pareamento | WA-01, WA-02 (local e produção) | — | **parear o número do escritório** (leitura do QR no aparelho); servidor Evolution é de terceiros | `544e413` |
| **Assistente de IA (Gemini)** | resumo, resposta, triagem, rascunho; consentimento do titular | sugestão real do Gemini; recusa sem habilitação; uso sem conteúdo | IA-01 (local e produção) | — | contrato de tratamento de dados com o Google (decisão do escritório); trocar a chave | `544e413` |
| Agentes de IA autônomos e automações | — | bloqueados | REAL-ERP-05 | — | política de uso aprovada; WhatsApp pareado | — |
| E-mail (Resend) | convites e recuperação | envio aceito; DKIM, SPF e DMARC publicados | REC-01 | — | e-mail a clientes não habilitado | `544e413` |
| Pagamentos (Asaas, InfinitePay, Mercado Pago) | — | bloqueado; baixa manual funciona | REAL-ERP-05 | — | **nenhuma credencial fornecida** | — |
| Assinatura digital (ZapSign) | registro manual de assinatura | bloqueado | — | — | **token não fornecido** | — |
| Cálculos jurídicos | gravam e reabrem | demonstrativos | unitários + E2E | — | validação por advogado(a); índices oficiais (licença) | `544e413` |
| DataJud (CNJ) | **não integrado** | a API pública responde (teste técnico só de contagem, sem dado de processo) | — | — | **os termos do CNJ (itens 3.3 e 3.8) proíbem uso comercial e exploração de informação derivada**: precisa de autorização do CNJ ou parecer jurídico antes de integrar num SaaS pago | — |
| Jusbrasil, Previdenciarista | **não integrado** | — | — | — | não há API para conta de usuário; automatizar o login viola os termos. Precisa de contrato comercial de API | — |

## Percentual operacional comprovado
- **Módulos (19 linhas acima):** 14 operacionais comprovados (74%), 1 com ressalva (cálculos), 4 bloqueados por terceiros ou termos (pagamentos, assinatura digital, DataJud, Jusbrasil/Previdenciarista). Agentes autônomos ficam fora da conta: o bloqueio é decisão de produto.
- **71 capacidades da matriz de paridade** (`01-…csv`): 19 operacionais (27%), 32 operacionais sem validação jurídica (45%), 11 parciais (15%), 7 bloqueadas (10%), 2 não implementadas (3%). Funcionam com dados reais: **72%**. Sem nenhuma ressalva: **27%**.

## Parecer
**Pronta para piloto comercial pago** em gestão jurídica, portal do cliente, white-label/PWA, atendimento por WhatsApp (depois de parear o número) e assistente de IA com revisão humana.
**Não pronta para venda ampla** até:
1. Rotacionar todas as credenciais coladas em conversa, inclusive Evolution, Gemini e as senhas de terceiros.
2. Ter número de WhatsApp e servidor Evolution do próprio LexSion, não compartilhado com outra empresa.
3. Credenciar pagamentos (assinatura e honorários).
4. Validar juridicamente os cálculos.
5. Obter autorização ou contrato para dados de tribunais.
