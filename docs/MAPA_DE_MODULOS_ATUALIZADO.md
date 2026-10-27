# Mapa de módulos (gerado do código)

Tabela abaixo gerada por script a partir de src/app/**/page.tsx, do <Guard area> de cada página, de src/content/route-help.ts e da presença da rota nos testes (	ests/). Total: **83 páginas**.

## Por módulo (resumo)
| Módulo | Telas | CRUD/operações reais na demo | Tour | Artigos |
|---|---|---|---|---|
| Acesso, onboarding, Meu dia | entrar, recuperar-acesso, boas-vindas, inicio | sessão demo, checklist, filtros, concluir tarefa | primeiro-acesso, meu-dia | primeiro-acesso, entender-modo-demo, operar-no-celular |
| CRM e triagem | crm, captura, leads/[id] | criar, mover, perder/reabrir, triar, converter, paginar | primeiro-lead | organizar-lead, converter-lead |
| Atendimento | atendimento | assumir, responder, nota interna, fila offline | atendimento | assumir-conversa |
| Clientes | clientes, novo, [id] | criar, editar responsável, abrir caso | cliente | cadastrar-cliente |
| Casos, processos, publicações | casos, processos, publicacoes | fase, vincular processo, andamento, atualização do portal | caso | abrir-caso |
| Controladoria | prazos, tarefas, agenda, audiencias, pericias | propor/confirmar/cumprir prazo, tarefas, compromissos, .ics | caso, agenda | registrar-prazo, agendar-pericia |
| Documentos | documentos, [id], solicitacoes | upload, solicitar, revisar extração, validar/rejeitar | documentos | solicitar-documento, revisar-extracao |
| Previdenciário | previdenciario, analises/[id] | pendências, revisão, relatório | previdenciario | comparar-cenarios |
| Cálculos e RPV | calculos, [id], requisitorios, [id] | criar, calcular, revisar, exportar; situação de RPV | — | usar-calculos, acompanhar-rpv |
| Pesquisa, jornal, minutas | pesquisa, jornal, minutas, modelos | salvar notícia, tarefa de revisão, editar/aprovar/**DOCX** | minutas | usar-jornal-pesquisa, revisar-minuta |
| Comercial | propostas, contratos, assinaturas | proposta, aprovação, contrato, assinatura simulada | proposta-assinatura | enviar-proposta, assinatura, entrada-e-parcelas |
| Financeiro | financeiro/*, pagamentos | baixa, estorno, renegociação, recibo, conciliação, caixa por mês, cobrança simulada | cobranca, conciliacao, financeiro-perfil | baixa-parcial, emitir-recibo, conciliacao |
| IA, automações, marketing | ia/*, automacoes/*, marketing/* | versões de agente, simulador, execuções, campanhas, páginas | — | assumir-conversa, conectar-whatsapp, organizar-lead |
| Administração | equipe, configuracoes, integracoes, importacoes, relatorios, admin/organizacoes | convite simulado, feriados, LGPD, conexão simulada, importação com reversão | integracoes | gerir-equipe, configurar-notificacoes, conectar-whatsapp, importar-csv, ler-relatorios |
| Portal do cliente | portal/* | ver caso publicado, enviar documento, dúvida | portal | (FAQ no portal) |
| Aprender | academia, ajuda, ajuda/[slug] | progresso de trilhas e tours | todos | 29 artigos + glossário |

Perfis: administrador, advogado(a), atendimento, **controladoria**, financeiro, estagiário(a), cliente, superadmin (src/domain/permissions.ts). Bloqueio é só na interface.

## Todas as rotas
| Rota | Área (permissão) | Artigo | Tour | Citada em teste |
|---|---|---|---|---|
| `/` | pública | — | — | sim |
| `/admin/organizacoes` | superadmin | — | — | sim |
| `/app/academia` | todas (shell) | entender-modo-demo | primeiro-acesso | sim |
| `/app/agenda` | agenda | agendar-pericia | agenda | sim |
| `/app/ajuda` | todas (shell) | recuperar-erros | — | sim |
| `/app/ajuda/[slug]` | todas (shell) | recuperar-erros | — | sim |
| `/app/assinaturas` | propostas | assinatura | proposta-assinatura | sim |
| `/app/atendimento` | atendimento | assumir-conversa | atendimento | sim |
| `/app/atendimento/[conversationId]` | atendimento | assumir-conversa | atendimento | sim |
| `/app/audiencias` | todas (shell) | agendar-pericia | agenda | sim |
| `/app/automacoes` | automacoes | conectar-whatsapp | — | sim |
| `/app/automacoes/[id]` | automacoes | conectar-whatsapp | — | sim |
| `/app/automacoes/execucoes` | automacoes | conectar-whatsapp | — | sim |
| `/app/boas-vindas` | todas (shell) | primeiro-acesso | primeiro-acesso | sim |
| `/app/calculos` | calculos | usar-calculos | — | sim |
| `/app/calculos/[id]` | calculos | usar-calculos | — | sim |
| `/app/casos` | casos | abrir-caso | caso | sim |
| `/app/casos/[id]` | casos | abrir-caso | caso | sim |
| `/app/clientes` | clientes | cadastrar-cliente | cliente | sim |
| `/app/clientes/[id]` | clientes | cadastrar-cliente | cliente | sim |
| `/app/clientes/novo` | clientes | cadastrar-cliente | cliente | sim |
| `/app/configuracoes` | configuracoes | configurar-notificacoes | — | sim |
| `/app/contratos` | propostas | assinatura | proposta-assinatura | sim |
| `/app/contratos/[id]` | propostas | assinatura | proposta-assinatura | sim |
| `/app/crm` | crm | organizar-lead | primeiro-lead | sim |
| `/app/crm/captura` | crm | organizar-lead | primeiro-lead | sim |
| `/app/crm/leads/[id]` | crm | organizar-lead | primeiro-lead | sim |
| `/app/documentos` | documentos | solicitar-documento | documentos | sim |
| `/app/documentos/[id]` | documentos | solicitar-documento | documentos | sim |
| `/app/documentos/solicitacoes` | documentos | solicitar-documento | documentos | sim |
| `/app/equipe` | equipe | gerir-equipe | — | sim |
| `/app/financeiro` | todas (shell) | baixa-parcial | cobranca | sim |
| `/app/financeiro/caixa` | financeiro | baixa-parcial | cobranca | sim |
| `/app/financeiro/conciliacao` | financeiro | conciliacao | conciliacao | sim |
| `/app/financeiro/pagar` | financeiro | baixa-parcial | cobranca | sim |
| `/app/financeiro/receber` | todas (shell) | baixa-parcial | cobranca | sim |
| `/app/financeiro/recibos` | financeiro | emitir-recibo | — | sim |
| `/app/ia/agentes` | ia | assumir-conversa | — | sim |
| `/app/ia/agentes/[id]` | ia | assumir-conversa | — | sim |
| `/app/ia/execucoes` | ia | assumir-conversa | — | sim |
| `/app/ia/objecoes` | ia | assumir-conversa | — | sim |
| `/app/ia/simulador` | ia | assumir-conversa | — | sim |
| `/app/importacoes` | importacoes | importar-csv | — | sim |
| `/app/importacoes/[id]` | importacoes | importar-csv | — | sim |
| `/app/inicio` | todas (shell) | primeiro-acesso | meu-dia | sim |
| `/app/integracoes` | integracoes | conectar-whatsapp | integracoes | sim |
| `/app/integracoes/[provider]` | integracoes | conectar-whatsapp | integracoes | sim |
| `/app/integracoes/eventos` | integracoes | conectar-whatsapp | integracoes | sim |
| `/app/jornal` | jornal | usar-jornal-pesquisa | — | sim |
| `/app/jornal/[id]` | jornal | usar-jornal-pesquisa | — | sim |
| `/app/jornal/alertas` | jornal | usar-jornal-pesquisa | — | sim |
| `/app/marketing/campanhas` | marketing | organizar-lead | — | sim |
| `/app/marketing/conteudos` | marketing | organizar-lead | — | sim |
| `/app/marketing/paginas` | marketing | organizar-lead | — | sim |
| `/app/minutas` | minutas | revisar-minuta | minutas | sim |
| `/app/minutas/[id]` | minutas | revisar-minuta | minutas | sim |
| `/app/modelos` | minutas | revisar-minuta | — | sim |
| `/app/pagamentos` | pagamentos | baixa-parcial | cobranca | sim |
| `/app/pericias` | todas (shell) | agendar-pericia | agenda | sim |
| `/app/pesquisa` | pesquisa | usar-jornal-pesquisa | — | sim |
| `/app/prazos` | prazos | registrar-prazo | caso | sim |
| `/app/previdenciario` | previdenciario | comparar-cenarios | previdenciario | sim |
| `/app/previdenciario/analises/[id]` | previdenciario | comparar-cenarios | previdenciario | sim |
| `/app/previdenciario/planejamentos/[id]` | redireciona para a análise | comparar-cenarios | previdenciario | (redirecionamento) |
| `/app/processos` | casos | abrir-caso | caso | sim |
| `/app/propostas` | propostas | enviar-proposta | proposta-assinatura | sim |
| `/app/propostas/[id]` | propostas | enviar-proposta | proposta-assinatura | sim |
| `/app/propostas/nova` | propostas | enviar-proposta | proposta-assinatura | sim |
| `/app/publicacoes` | prazos | registrar-prazo | caso | sim |
| `/app/relatorios` | relatorios | ler-relatorios | — | sim |
| `/app/requisitorios` | requisitorios | acompanhar-rpv | — | sim |
| `/app/requisitorios/[id]` | requisitorios | acompanhar-rpv | — | sim |
| `/app/tarefas` | tarefas | registrar-prazo | meu-dia | sim |
| `/boas-vindas` | pública | — | — | sim |
| `/design-system` | pública | — | — | sim |
| `/entrar` | pública | — | — | sim |
| `/offline` | pública | — | — | sim |
| `/portal` | portal (cliente) | — | portal | sim |
| `/portal/ajuda` | portal (cliente) | — | — | sim |
| `/portal/casos/[id]` | portal (cliente) | — | — | sim |
| `/portal/documentos` | portal (cliente) | — | — | sim |
| `/portal/pagamentos` | portal (cliente) | — | — | sim |
| `/recuperar-acesso` | pública | — | — | sim |
