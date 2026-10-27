# Backlog do backend (próxima fase)

Prioridade sugerida. Nada disto está implementado; o frontend já usa os contratos de `services/contracts.ts`.

1. **Supabase Auth + RLS por organização** — substitui `domain/permissions.ts` visual; MFA para admin; sessão no servidor; HTML autenticado passa a NetworkOnly no SW.
2. **Banco e migrations** a partir de `domain/types.ts` (centavos inteiros, datas civis como `date`, auditoria append-only).
3. **Storage de documentos** com URL assinada, antivírus e limite de 15 MB (mesmas regras de `ops-repo.ts`).
4. **Evolution API (WhatsApp)** — webhook de entrada, outbox com chave de idempotência (já modelado), confirmação de transporte (Baileys × Cloud API) com a instância existente.
5. **Pagamentos** (Asaas / InfinitePay / Mercado Pago): webhook assinado, dedupe por evento, transições de `applyChargeEvent`; retorno de checkout nunca quita cobrança.
6. **ZapSign**: eventos de assinatura → `applySignature` (já idempotente).
7. **Resend**: e-mails transacionais e recuperação de acesso.
8. **IA**: agentes com base de conhecimento por escritório, logs de execução, revisão humana obrigatória.
9. **DataJud e publicações**: ingestão monitorada; prazos continuam “propostos” até confirmação.
10. **Push** (Web Push com VAPID) por preferência de evento/canal.
11. **Billing SaaS** separado dos honorários.
12. **Exportação DOCX** de minutas.
