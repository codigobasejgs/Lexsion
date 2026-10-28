# 08 — Bloqueios objetivos

| # | Bloqueio | Tipo | Efeito na operação | Para destravar |
|---|---|---|---|---|
| B1 | WhatsApp (Evolution) | credencial | `/app/atendimento` bloqueado | URL e chave da instância; decisão Baileys × Cloud API |
| B2 | Pagamentos de honorários (Asaas/InfinitePay/Mercado Pago) | credencial | `/app/pagamentos` bloqueado; baixa manual de parcela funciona | conta do escritório, chave e segredo de webhook |
| B3 | Faturamento da assinatura LexSion | credencial | nenhuma fatura SaaS emitida | conta de cobrança da plataforma |
| B4 | Assinatura eletrônica (ZapSign) | credencial | `/app/assinaturas` bloqueado; contrato aceita registro manual | token + webhook |
| B5 | IA | contrato/LGPD | `/app/ia` bloqueado | provedor, DPA, limites |
| B6 | Automações / envio a clientes (e-mail e WhatsApp) | credencial | `/app/automacoes` bloqueado | B1 + e-mail transacional a clientes |
| B7 | Marketing e anúncios | OAuth | `/app/marketing`, `/app/crm/captura` bloqueados | contas Meta/Google |
| B8 | Jornal do Advogado | licença/coleta | bloqueado | rotina de coleta de fontes oficiais |
| B9 | Pesquisa de jurisprudência | licença | bloqueado | Jusbrasil ou parecer DataJud |
| B10 | Cálculos e regras previdenciárias | validação jurídica | funcionam, marcados como demonstrativos | revisão por advogado(a) habilitado(a) |
| B11 | Entrega de e-mail do Resend | verificação | DKIM/SPF/DMARC publicados e envio aceito (HTTP 200); entrega não consultável com chave só de envio | conferir painel Resend ou criar chave de leitura |
| B12 | Credenciais coladas em conversa | segurança | **devem ser rotacionadas** | ver `10` |
| B13 | PITR do banco | plano | backup lógico próprio cobre por ora | ativar PITR |
| B14 | MFA para Super Admin | configuração | não exigido ainda | ativar TOTP no Auth e na conta do dono |
