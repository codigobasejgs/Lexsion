# Integrações e backend — fase 2

**Nenhuma integração está conectada.** Telas mostram “Planejado”, “Em teste (demo)” ou “Operacional (demo)” — este último significa simulado no navegador. Credenciais existirão **somente no servidor**; nenhum campo do frontend pede senha de portal de terceiros. Custos, limites e termos dos provedores devem ser conferidos na documentação oficial no momento da contratação (não foram verificados nesta fase).

| Provedor | Finalidade | Status demo | Credenciais (só servidor) | Eventos / estados | Riscos e proteções | Ativação |
|---|---|---|---|---|---|---|
| **Supabase** | Auth (com MFA), Postgres, Storage privado, RLS | Planejado | URL do projeto, service role | — | RLS por organização, pessoa e caso; Storage privado com URL assinada; auditoria append-only; backups e migrações versionadas | modelar tabelas a partir de `domain/types.ts`; trocar `services/mock` por adapters |
| **Evolution API** (WhatsApp) | Atendimento, envio e recebimento | Operacional (demo) — fila local | URL + chave da instância | `messages.upsert`, `connection.update` → estados de mensagem (fila, enviada, entregue, lida, falhou) | consentimento e opt-out; identificar atendimento automatizado; reenvio idempotente (já modelado no outbox) | confirmar transporte (Baileys × Cloud API) com a instância existente |
| **Resend** | E-mails transacionais e recuperação de acesso | Não configurado | API key | entregue, devolvido, reclamação | domínio verificado (SPF/DKIM); sem dados sensíveis no corpo | após Auth |
| **Asaas / InfinitePay / Mercado Pago** | Cobrança de honorários (Pix, boleto, cartão, link) | Planejado / em teste (demo) | chaves de API e segredo de webhook | criada → pendente → paga/parcial/vencida/cancelada/estornada (`applyChargeEvent`) | webhook autenticado; dedupe por id do evento; **retorno do checkout nunca quita**; reconciliação diária | escolher provedor; homologar em sandbox |
| **ZapSign** | Assinatura de contratos | Em teste (demo) | token da API | enviado, assinado por signatário, recusado, expirado (`applySignature`) | só conclui com todos os obrigatórios; reenvio não gera parcelas | sandbox |
| **DataJud/CNJ, TRF1–TRF6, JEF/CJF, e-SAJ, eproc** | Movimentações e publicações | Planejado (links para consulta pública) | conforme cada fonte autorizada | andamento coletado → revisão humana | respeitar termos; não acessar autos sigilosos; prazos continuam “propostos” | avaliar API pública/convênio por fonte; foco inicial Bahia/TRF1 |
| **INSS / CRPS (Meu INSS)** | Dados previdenciários | Planejado | não armazenar credenciais do segurado | — | coleta só com autorização expressa e por canal oficial | definir com a cliente |
| **Meta Ads / Google Ads** | Atribuição de leads e métricas | Planejado (UTM demo) | OAuth da conta do escritório | lead recebido, conversão | normas da OAB sobre publicidade; sem promessa de resultado | após aprovação da conta |
| **IA assistiva** | Resumo, sugestão de resposta e minuta | Simulada (textos fixos rotulados) | chave do provedor aprovado | execução, revisão humana | sem dados sensíveis sem base legal; registrar execuções; revisão obrigatória; nunca citar fonte inexistente | escolher provedor e política de dados |

## Ordem sugerida
1. Supabase Auth + RLS (substitui as permissões visuais).
2. Tabelas e migrações; Storage de documentos.
3. Evolution API (outbox já pronto).
4. Pagamentos (webhooks) e ZapSign.
5. Resend; push (Web Push) por preferência; fontes processuais.
6. DOCX no servidor (se precisar de modelos com tabelas/estilos avançados).
