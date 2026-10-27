# 10 — ERP: módulos, fluxos e lacunas

Inventário completo de módulos e telas: `docs/MAPA_DE_MODULOS_ATUALIZADO.md` (mantido). Rotas: `01-INVENTARIO-ROTAS.md`.

| Grupo | Módulos | Fluxos testados | Lacuna real |
|---|---|---|---|
| Meu dia | início, notificações, busca | foundation, tours | — |
| Atendimento e comercial | conversas, funil (CRM), captura, propostas, contratos, assinaturas, marketing | jornada E2, FLUXO A, CRM-05, journeys 1 | envio WhatsApp/assinatura real (backend) |
| Clientes e jurídico | clientes (+aniversariantes), casos, processos, publicações, prazos, agenda, audiências, perícias, tarefas (+recorrentes), documentos, previdenciário, cálculos, RPV/precatórios, minutas, modelos, pesquisa, jornal | FLUXO E/G, DOC-03..07, F18-01/02, PREF-01 | monitoramento de tribunais, OCR, regras previdenciárias validadas (proprietário) |
| Financeiro do escritório | receber, pagar, caixa, conciliação, recibos, pagamentos | A10, FIN-06/10, SEC-03 | gateway real (backend) |
| IA e automações | agentes, simulador, execuções, objeções, automações | journeys (render/axe) | IA real (provedor a definir) |
| Gestão | equipe (matriz), relatórios, importações (CSV/Tícius), integrações, configurações (+assinatura, e-mails, marca), boas-vindas, academia, ajuda | E2E-12, QA-RBAC-*, ROB-*, HELP | — |
| Portal do cliente | início, casos, documentos, pagamentos, ajuda | PORT-02, PREF-01, foundation | pagamento online (backend) |

Antirregressões do prompt (seção 24): todas verificadas — ver `17-RELATORIO-BUGS-REGRESSOES.md`.
