# Matriz Tícius → SIWILTEC

Fonte: `Documentação/Tícius - Gestão de Escritório de Advocacia (3).xlsb`, lida **somente a estrutura** (nomes de abas e nomes definidos) por script sobre o ZIP, sem abrir no Excel e sem executar macros (o arquivo contém `vbaProject.bin`). Fórmulas e macros **não** foram inspecionadas: a equivalência profunda depende de inspeção segura com a cliente. Nenhum dado das células foi lido nem importado.

Abas encontradas (21): Senha, Menu Inicial, Clientes, Prazos, Processos, Audiências, Agenda, Leads, Perícias, Configurações, Configurações Feriados, Recibo, Usuário, Suporte, Termos de uso, Configurações Senhas, Caixa, Controle de Parcelas, Financeiro, Dashboard (+ aba técnica `EstaPasta_de_trabalho`). Nomes definidos indicam macros de filtro (hoje, amanhã, semana, atrasados), relatórios, recibo, backup e tela cheia.

| Aba | Função na planilha (pelos nomes) | Módulo SIWILTEC | Operação demonstrável | Estado e vínculo | Validações | Tour / artigo | E2E | Limitações / importação futura |
|---|---|---|---|---|---|---|---|---|
| Menu Inicial | navegação por botões | Meu dia + menu lateral/inferior | itens por urgência com motivo | derivado de prazos, tarefas, conversas, parcelas, publicações, propostas | — | `primeiro-acesso`, tour `meu-dia` | J 3, QF GEN-01 | — |
| Clientes | cadastro, ativos/inativos, aniversários, detalhes | Clientes 360 | criar, buscar, ficha com casos/docs/financeiro | ligado a leads, casos, parcelas | CPF/CNPJ com dígito, telefone, data civil, duplicidade | `cadastrar-cliente`, tour `cliente` | E2, journey-e2 | aniversários: não implementado |
| Leads | cadastro, retornos, aniversários | Funil (CRM) | quadro/lista, mover, perda com motivo, conversão, triagem | origem/UTM, conversa, cliente | obrigatórios, duplicado por telefone | `organizar-lead`, tour `primeiro-lead` | E2, QF FLUXO A | “retornos hoje” = próxima ação (sem filtro dedicado) |
| Processos | cadastro, concluídos | Casos e Processos | vincular processo ao caso, andamentos | caso, cliente, prazos | CNJ (mod 97) | `abrir-caso`, tour `caso` | J rotas | consulta automática: fase futura |
| Prazos | a vencer, hoje, atrasados, concluídos | Prazos | proposto → confirmado → cumprido, memória de contagem | caso, agenda, Meu dia | dias úteis/corridos, feriados, justificativa | `registrar-prazo` | J 3 | regras por tribunal: dependem de validação |
| Audiências | hoje, amanhã, semana, atrasadas | Agenda + Audiências | criar, reagendar com motivo, comparecimento | caso, cliente, portal | conflito de horário | `agendar-pericia`, tour `agenda` | J rotas | — |
| Perícias | idem | Agenda + Perícias | documentos a levar, resultado | caso, portal | idem | idem | J rotas | — |
| Agenda | calendário mensal | Agenda (lista/dia/semana/mês) + .ics | exportar .ics | eventos e prazos confirmados | — | tour `agenda` | J 3 | — |
| Configurações | dados do escritório, logo | Configurações → Escritório/Aparência | horário, áreas, categorias, cor | — | contraste automático | `configurar-notificacoes` | J rotas | logo oficial pendente |
| Configurações Feriados | feriados | Configurações → Feriados | adicionar feriado, nova versão do calendário | prazos registram versão | data + nome | `registrar-prazo` | U domain-e3e7 | calendário oficial por tribunal |
| Recibo | gerar e limpar recibo | Financeiro → Recibos | gerar recibo do pagamento, imprimir/baixar | pagamento, cliente | valor por extenso | `emitir-recibo` | J 4 | — |
| Usuário / Configurações Senhas / Senha | login e senhas na planilha | Entrar (demo), Equipe, Configurações | perfis fictícios, convite simulado | — | — | `gerir-equipe` | QF GEN-01, ADM-01 | **senhas da planilha nunca são migradas**; autenticação real no backend |
| Suporte | tutorial | Central de ajuda + Academia + tours | busca com sinônimos, prints reais | rota → artigo → tour | — | todos | U help, QF HELP | — |
| Termos de uso | termos | Configurações → Dados e LGPD | retenção, exportação, pedido de eliminação | — | — | — | — | texto jurídico de termos: a cliente fornece |
| Caixa | entradas/saídas, saldo | Financeiro → Caixa | filtro por mês, saldo inicial, CSV | pagamentos, despesas | data efetiva | `baixa-parcial` | QF FIN-06 | — |
| Controle de Parcelas | parcelamentos, hoje/semana/atrasados, recebidos | Financeiro → A receber | baixa parcial, estorno, renegociação, lembrete | contrato, cliente, caixa | centavos inteiros, soma = total | `baixa-parcial`, `entrada-e-parcelas` | F A10, J 4 | — |
| Financeiro | lançamentos, categorias, fornecedores | Financeiro (visão geral, a pagar) | indicadores com definição explícita | parcelas, despesas | — | `baixa-parcial` | J rotas | fornecedores: cadastro simples |
| Dashboard | painel e relatório | Relatórios + Meu dia | gráficos acessíveis com tabela e CSV | mesma fonte das listas | divisão por zero → “não calculável” | `ler-relatorios` | J rotas | — |

**Importação da planilha real:** exportar cada aba como CSV UTF-8 e usar Importações (prévia, duplicidade, erros por linha, reversão). XLSB direto não é aceito de propósito: evita executar ou carregar macros.
