# 02 — Modelo de dados e RLS

## Tabelas
| Tabela | Conteúdo | Quem lê / grava |
|---|---|---|
| `organizations` | escritório, situação, plano, marca, metadados | membro lê o próprio; titular edita só nome/marca; status/plano só pela plataforma (funções) |
| `organization_memberships` | papel de cada pessoa no escritório | membro lê; titular/gestor grava |
| `platform_members` | equipe LexSion | só a própria linha |
| `profiles` | nome exibido | próprio + colegas de escritório |
| `collection_policies` | papéis que leem/gravam cada tipo de registro | leitura geral (é regra, não dado) |
| `org_records` | **todos os registros do ERP** (clientes, casos, tarefas, agenda, prazos, documentos, minutas, CRM, financeiro…) em JSON tipado pelo domínio | RLS por escritório **e** por papel; ver abaixo |
| `portal_links` | cliente do portal ↔ cadastro de cliente | o próprio cliente; advogado(a)/titular vinculam |
| `platform_records` | chamados, faturas SaaS, planos | só a plataforma |
| `audit_logs` | trilha append-only | titular do escritório e plataforma |
| `clients`, `cases`, `documents`, `drafts`, `tasks`, `portal_updates`, `client_portal_access` | modelo tipado da Onda 1 (testado, reservado para relatórios/integrações) | RLS própria |

## Regras garantidas no banco (não dependem da tela)
- Escritório A não lê, altera, apaga nem grava registros de B; o JSON não pode declarar outro escritório (`check`).
- Papel: financeiro não lê CRM; estagiário não lê honorários; correspondente externo só vê o que lhe foi atribuído; caso sigiloso só titular/advogado(a)/responsável.
- Aprovação de minuta e de proposta, e publicação no portal: só advogado(a)/titular (trigger). Minuta com campo `[… — não preenchido]` não aprova.
- Laudo/exame nunca é compartilhado com o cliente.
- Escritório suspenso, inadimplente ou cancelado perde o acesso (dados preservados).
- Gravação em lote é tudo-ou-nada com versão: dado desatualizado gera conflito, nunca sobrescreve.
- Auditoria automática de toda inclusão/alteração/exclusão, com autor.
- Portal: cliente **não** lê `org_records`; recebe só campos leigos pela função `portal_snapshot`, envia arquivo só para pedido aberto dele (`portal_send_document`) e pergunta à equipe (`portal_ask`).

## Migrations (todas aditivas, aplicadas com dry-run antes)
`20261028120000_nucleo_multitenant` · `140000_corrige_exclusoes` · `150000_status_convites` · `160000_erp_operacional` · `170000_registros_operacionais` · `180000_meu_acesso`
