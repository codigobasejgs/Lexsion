# Integrações — estado real (04/11/2026)

Regra: Evolution, Resend e Gemini são da **plataforma** (uma conta, chaves só no servidor). As demais são por escritório.

| Integração | Dono | Estado em produção | Prova | Bloqueio |
|---|---|---|---|---|
| Supabase (banco, auth, storage, Realtime, cron) | plataforma | operacional (Free) | migrações aplicadas; cron `lexsion-*` | — |
| Vercel (hospedagem) | plataforma | operacional | deploy `8d7ea71` (reimplantado com as variáveis) READY | uso comercial pede Vercel Pro |
| Cloudflare R2 (backup cifrado) | plataforma | operacional | `backup.ok` diário em audit_logs | — |
| Resend (e-mail) | plataforma | operacional | códigos de aceite e convites entregues | `responda@` sem MX (token Cloudflare sem permissão de Email Routing) |
| InfinitePay (assinatura) | plataforma | teste de 30 dias sem cartão | contrato LX-2026-93888B06D6 | CNPJ ou tag e autorização de R$ 1 para cobrança paga |
| Evolution (WhatsApp) | plataforma (servidor operado por Tubarão Empréstimos LTDA, Brasil) | **ligada** (`WHATSAPP_ENABLED=1`, 04/11); cada escritório conecta o próprio número pelo QR | QR real gerado e webhook regravado em instância `lexsion-qa-…` (removida), sem parear; webhook sem segredo → 401 em produção | nenhum: falta o titular ler o QR |
| Gemini (IA) | plataforma | **ligada** (`AI_ENABLED=1`, 04/11), mas **sem crédito**: a API responde 402 “prepayment credits are depleted” | chamada real com texto fictício em 04/11 | **recarregar créditos do projeto no Google AI Studio**; até lá, toda resposta vai para a equipe e o simulador mostra a falha |

## Atendimento WhatsApp — como funciona
1. A Evolution chama `/api/whatsapp/webhook?org=…&s=…`. O segredo é próprio do escritório (só o hash fica no banco) e é comparado em tempo constante.
2. O evento é gravado em `wa_events` (único por instância + tipo + id) **antes** do 200. Se a gravação falha, a resposta é 500 e a Evolution reenvia.
3. O processamento roda depois da resposta (`after`). O cron `lexsion-atendimento` (1 min) repete o que falhou e devolve ao humano trabalho preso há mais de 3 minutos.
4. Grupo, status, broadcast e canal são ignorados antes de criar conversa. Mensagens próprias podem ser registradas como resposta da equipe e suspender a IA; não acionam geração.
5. Uma mensagem do contato numa conversa em modo `ia` gera um `ai_jobs` com debounce de 8 s. A geração usa a versão **publicada** da assistente.
6. `ai_job_claim_send` confere modo e versão em transação, mas a chamada ao provedor ocorre depois. **Corrida aberta:** takeover após a confirmação do portão ainda pode preceder o envio externo; não há garantia de cancelamento imediato.
7. Falha ou pedido de atendente tenta encaminhar à equipe. O limite diário é consultado antes da chamada, sem reserva atômica; concorrência pode ultrapassá-lo. Recuperação de falhas e alterações concorrentes exigem validação adicional.

## Começar a usar (escritório)
1. Titular: Integrações → WhatsApp (Evolution) → “Gerar QR”; no celular do escritório, WhatsApp → Aparelhos conectados → ler o QR. O estado muda para “Conectado”.
2. Titular: Integrações → Assistente de IA → “Habilitar IA” (consentimento registrado).
3. IA → Agentes → “Nova assistente” → preencher Base de conhecimento → testar no Simulador → “Publicar versão” → marcar “Atende no WhatsApp”.
4. Conversas novas de contatos individuais começam com a assistente; “Assumir atendimento” interrompe a IA (inclusive resposta já gerada e ainda não enviada).

## Corridas e limites (fechados em 04/11, migração 20261104090000)
- Takeover × envio: o portão grava a reserva de envio na conversa; imediatamente antes da chamada ao provedor, `ai_job_confirm_send` confere de novo e assumir a conversa derruba a reserva. Janela residual: apenas a própria chamada HTTP ao provedor já em trânsito. Provas: teste de banco "corrida residual" e teste real "QA11 residual".
- Cota diária: `ai_quota_take` reserva de forma atômica antes do modelo (teste de banco com limite 3 → 4ª recusada).
- WhatsApp desligado na plataforma: o cron encaminha a fila pendente à equipe.

## Contrato
Publicado o modelo **2026.11-2** em 04/11 (13.1, Anexo II, III.4 e III.7 (f)/(g): Evolution operado por Tubarão Empréstimos LTDA no Brasil; Google LLC Gemini nos EUA). O contrato aceito LX-2026-93888B06D6 manteve o próprio texto. Faturamento do Gemini não é afirmado no contrato.
