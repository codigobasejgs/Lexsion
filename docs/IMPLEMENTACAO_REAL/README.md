# Implementação real — índice

| Doc | Situação |
|---|---|
| 00 Auditoria inicial | ✅ |
| 01 Matriz de realidade funcional (CSV, por rota) | ✅ — 3 rotas reais, 75 na demonstração, 26 estáticas |
| 02 Banco e RLS | ✅ aplicado |
| 03 Migrations e rollback | ✅ (restauração de backup **não testada**) |
| 04 Auth, escritórios e papéis | ✅ |
| 05 Cálculos e homologação jurídica | ⏳ sem mudança nesta etapa — ver `docs/PARIDADE_5_PLATAFORMAS/04-…` |
| 06 Integrações | ✅ estado verdadeiro |
| 07 Eventos, webhooks e idempotência | ⏳ nenhum webhook real ainda (nenhum provedor de pagamento/mensagem conectado) |
| 08 Manual operacional | ⏳ comandos em `03-…`; manual completo quando o ERP usar o banco |
| 09 Testes e evidências | ✅ |
| 10 Segurança e LGPD | ⏳ parcial em `02-…`/`04-…` (RLS, anti-enumeração, exclusão, credenciais) |
| 11 Pendências | ✅ |
| 12 Parecer GO/NO-GO | ✅ NO-GO para dados reais |
