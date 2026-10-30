# 08 — Bloqueios objetivos

| # | Bloqueio | Tipo | Efeito na operação | Para destravar |
|---|---|---|---|---|
| B1 | WhatsApp (Evolution) | **integrado** (28/10) | Conversas e envio reais; falta só parear o número do escritório | ler o QR em Integrações → Evolution; recomendado servidor Evolution próprio da LexSion |
| B2 | Pagamentos de honorários (Asaas/InfinitePay/Mercado Pago) | credencial | `/app/pagamentos` bloqueado; baixa manual de parcela funciona | conta do escritório, chave e segredo de webhook |
| B3 | Faturamento da assinatura LexSion | credencial | nenhuma fatura SaaS emitida | conta de cobrança da plataforma |
| B4 | Assinatura eletrônica (ZapSign) | credencial | `/app/assinaturas` bloqueado; contrato aceita registro manual | token + webhook |
| B5 | IA | **integrada** (Gemini, 28/10) | Assistente com revisão humana; agentes autônomos seguem bloqueados | habilitação pelo titular; contrato de tratamento de dados com o Google; rotacionar a chave |
| B6 | Automações / envio a clientes (e-mail e WhatsApp) | credencial | `/app/automacoes` bloqueado | B1 + e-mail transacional a clientes |
| B7 | Marketing e anúncios | OAuth | `/app/marketing`, `/app/crm/captura` bloqueados | contas Meta/Google |
| B8 | Jornal do Advogado | **parcial: ativo** (29/10) | Câmara e Senado coletados a cada 3 h pelo agendador do servidor, com versões e alertas por área; Planalto, LexML, DOU e INSS indisponíveis ou sem credencial (`13`) | INLABS da LexSion (DOU); e-mail digest; resumo por IA com citação |
| B9 | Pesquisa de jurisprudência / dados de tribunais | **termos** | bloqueado | DataJud: termos do CNJ vedam uso comercial (itens 3.3 e 3.8), exige autorização ou parecer. Jusbrasil e Previdenciarista: sem API para conta de usuário, exige contrato comercial. Os logins enviados não foram usados |
| B10 | Cálculos e regras previdenciárias | validação jurídica | funcionam, marcados como demonstrativos | revisão por advogado(a) habilitado(a) |
| B11 | Entrega de e-mail do Resend | verificação | DKIM/SPF/DMARC publicados e envio aceito (HTTP 200); entrega não consultável com chave só de envio | conferir painel Resend ou criar chave de leitura |
| B12 | Credenciais coladas em conversa | segurança | **devem ser rotacionadas** | ver `10` |
| B13 | PITR do banco | **plano Free (decisão do dono: sem upgrade)** — risco **não eliminado** | mitigado: backup lógico diário cifrado (AES-256-GCM) no R2 às 06:17 UTC, 30 cópias, restauração verificada; perda máxima ≈ 24 h; arquivos do Storage **fora** do backup | só se eliminaria com PITR pago; não contratar sem autorização |
| B14 | MFA para Super Admin | **resolvido** (29/10) | `is_platform` exige `aal2` no banco; APIs de admin conferem no servidor; tela pede o código TOTP | — |
| B16 | Arquivos do Storage no backup | **resolvido** (30/10) | cópia incremental cifrada no R2, com SHA-256 por arquivo; restauração isolada provada (banco + arquivos + correspondência documento ⇄ arquivo); ver `15` | — |
| B17 | Contratação self-service (InfinitePay) | **implementada e desligada** (30/10) | fluxo completo publicado; venda bloqueada por 2 travas (preço aprovado + `SAAS_CHECKOUT_ENABLED`); tag `$marco-boggian` com checkout habilitado; ver `16` | aprovar preços; API Key (recomendado); revisão jurídica dos termos; **autorizar 1 compra real de teste** (sem sandbox); confirmar CNPJ no comprovante |
| B18 | Recorrência automática | limitação do provedor | a API da InfinitePay não tem assinatura: cada período vira um link enviado por e-mail, 7 dias antes | — (ou outro provedor com recorrência) |
| B15 | Servidor Evolution compartilhado | operação | instâncias `lexsion-*` isoladas por nome no servidor de outra empresa | servidor e chave próprios da LexSion |
