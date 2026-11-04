# Integrações — estado real (03/11/2026)

Regra: Evolution, Resend e Gemini são da **plataforma** (uma conta, chaves só no servidor). As demais são por escritório.

| Integração | Dono | Estado em produção | Prova | Bloqueio |
|---|---|---|---|---|
| Supabase (banco, auth, storage, Realtime, cron) | plataforma | operacional (Free) | migrações aplicadas; cron `lexsion-*` | — |
| Vercel (hospedagem) | plataforma | operacional | deploy `8b48b51` READY | uso comercial pede Vercel Pro |
| Cloudflare R2 (backup cifrado) | plataforma | operacional | `backup.ok` diário em audit_logs | — |
| Resend (e-mail) | plataforma | operacional | códigos de aceite e convites entregues | `responda@` sem MX (token Cloudflare sem permissão de Email Routing) |
| InfinitePay (assinatura) | plataforma | teste de 30 dias sem cartão | contrato LX-2026-93888B06D6 | CNPJ ou tag e autorização de R$ 1 para cobrança paga |
| Evolution (WhatsApp) | plataforma | **desligada** (`WHATSAPP_ENABLED` vazio; webhook responde 503) | smoke 03/11 | contrato 2026.11-2 e confirmações abaixo |
| Gemini (IA) | plataforma | **desligada** (`AI_ENABLED` vazio) | — | contrato 2026.11-2 e confirmações abaixo |

## Atendimento WhatsApp — como funciona
1. A Evolution chama `/api/whatsapp/webhook?org=…&s=…`. O segredo é próprio do escritório (só o hash fica no banco) e é comparado em tempo constante.
2. O evento é gravado em `wa_events` (único por instância + tipo + id) **antes** do 200. Se a gravação falha, a resposta é 500 e a Evolution reenvia.
3. O processamento roda depois da resposta (`after`). O cron `lexsion-atendimento` (1 min) repete o que falhou e devolve ao humano trabalho preso há mais de 3 minutos.
4. Grupo, status, broadcast e canal são ignorados antes de criar conversa. Mensagens próprias podem ser registradas como resposta da equipe e suspender a IA; não acionam geração.
5. Uma mensagem do contato numa conversa em modo `ia` gera um `ai_jobs` com debounce de 8 s. A geração usa a versão **publicada** da assistente.
6. `ai_job_claim_send` confere modo e versão em transação, mas a chamada ao provedor ocorre depois. **Corrida aberta:** takeover após a confirmação do portão ainda pode preceder o envio externo; não há garantia de cancelamento imediato.
7. Falha ou pedido de atendente tenta encaminhar à equipe. O limite diário é consultado antes da chamada, sem reserva atômica; concorrência pode ultrapassá-lo. Recuperação de falhas e alterações concorrentes exigem validação adicional.

## Para ligar IA e WhatsApp (ordem)
1. Titular confirma: (a) quem opera o servidor Evolution e onde ele está; (b) que a chave Gemini é de projeto **com faturamento ativo** (plano pago: o conteúdo não é usado para melhorar produtos do Google).
2. Publicar o contrato 2026.11-2 (minuta abaixo) pelo painel Super Admin (Contratos → nova versão).
3. Corrigir e testar as corridas de envio, retomada humana, limite e recuperação. Os testes com provedores simulados não homologam Evolution ou Gemini.
4. Só então considerar as variáveis de ativação e homologar por escritório, com testes controlados e sem envio real não autorizado.

## Minuta 2026.11-2 (substitui os trechos indicados; o restante segue igual a 2026.11-1)
- **13.1** (troca da última frase): "Integram também o serviço, quando ativados pela CONTRATANTE: o servidor de WhatsApp (Evolution API), operado por [OPERADOR] em [LOCAL], que recebe e envia as mensagens do número conectado pelo escritório; e a inteligência artificial Google Gemini (Google LLC), contratada em plano pago, que gera respostas e sugestões a partir do texto enviado. A ativação da inteligência artificial depende de consentimento do titular do escritório na plataforma."
- **III.4** (troca da última frase): "As integrações de WhatsApp e de inteligência artificial só tratam dados de clientes depois de ativadas pelo titular do escritório. O Google não usa o conteúdo enviado ao Gemini para treinar modelos, conforme os termos do plano pago."
- **III.7** (acrescentar): "(f) [OPERADOR] — servidor de WhatsApp (Evolution API); número, nome de perfil e conteúdo das mensagens das conversas individuais; [LOCAL]. (g) Google LLC (Gemini API, plano pago) — geração de respostas e sugestões; texto das mensagens e as informações configuradas na assistente; Estados Unidos."
- **Anexo II** (troca da segunda frase): "As respostas automáticas no WhatsApp se identificam como assistente virtual, seguem as regras da plataforma e as configuradas pelo escritório, e são encaminhadas a uma pessoa da equipe em caso de dúvida, urgência, pedido do contato ou falha; sugestões da inteligência artificial exigem revisão humana antes de uso em peças ou pareceres."

[OPERADOR] e [LOCAL] precisam do titular; o painel recusa publicar enquanto houver marcador entre colchetes no texto.
