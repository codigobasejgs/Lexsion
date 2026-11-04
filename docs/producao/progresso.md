# Progresso — conclusão, QA e produção (checkpoint)

> **Alerta de revisão:** as afirmações abaixo de conclusão e cancelamento imediato do atendimento são históricas e não comprovam segurança para ativação. Há uma corrida entre `ai_job_claim_send` e o envio externo: um takeover pode ocorrer entre eles. Limites concorrentes e recuperação também precisam de validação. IA e WhatsApp permanecem bloqueados para ativação. Consulte `integracoes.md` e `operacao.md` para os riscos atuais.

Retomar daqui. Ordem combinada com o titular (03/11/2026): **atendimento primeiro**; importação do IndexedDB e conectores de honorários depois.

## Decisões em vigor
- IA e WhatsApp: **liberar em produção** (revoga a trava de 03/11). Antes de ligar `AI_ENABLED=1` e `WHATSAPP_ENABLED=1` na Vercel ainda faltam o modelo de contrato 2026.11-2 descrevendo Evolution e Gemini como ativos e a confirmação do operador do servidor Evolution e do faturamento do Gemini.
- Sem número de teste: toda validação usa eventos sintéticos. Nenhum aparelho é pareado e nenhuma mensagem real é enviada.
- Supabase Free é a fonte da verdade; IndexedDB só demonstração, cache e rascunho.

## Fase 1 — atendimento WhatsApp (03/11/2026) — código pronto, banco aplicado, ainda não publicado
| Item | Situação | Prova |
|---|---|---|
| Fila durável: webhook grava `wa_events` (único por instância + tipo + id) antes do 200; processa depois (`after`) | feito | `tests/db/atendimento.test.ts` (dedupe) |
| Grupo, status, broadcast, canal e mensagem própria nunca disparam IA; grupo sem envio manual | feito | `tests/unit/wa-inbox.test.ts` (sem tocar no banco) |
| Fora de ordem: `lastMessageAt` só avança; ids determinísticos de conversa e mensagem | feito | revisão de código |
| Eco do próprio envio (fromMe) reconhecido; resposta pelo aparelho suspende a IA | feito | revisão de código |
| Controle IA × humano com versão (`conversation_control`); assumir cancela a IA na mesma transação | feito | 9 testes de banco |
| Corrida: IA gerou, humano assumiu ⇒ `ai_job_claim_send` descarta, nada sai | feito | teste "corrida" |
| `aiActive` espelhado pelo banco (cache antigo do navegador não reativa a IA) | feito | teste "cache antigo" |
| Assistente Gemini: agente publicado, regras da plataforma acima do conteúdo, limite diário, pedido de humano, falha ⇒ humano com aviso | feito | testes unitários do prompt e do pedido de humano |
| Cron `lexsion-atendimento` (1 min; só chama a aplicação quando há trabalho) | aplicado | `cron.job` conferido; disparo ocioso devolve null |
| Realtime na caixa (org_records na publicação) | feito | publicação conferida |
| Migração `20261103150000_atendimento_fila.sql` | aplicada em 03/11 | backup lógico antes (`_scratch/backup-pre-atendimento-20261103`) |

Verificação local: typecheck ok · lint 0 erros (5 avisos conhecidos) · banco 114/114 · unitários 180/181 (o `.docx` de amostra é pulado quando roda isolado; não tem relação com esta mudança).

Publicado: `8b48b51` com CI verde e Vercel READY. Smoke em produção: webhook 503 (integração desligada), cron sem segredo 401, home 200.

## Fase 2 — assistente configurável (03/11/2026) — commit `daadc7d`, ainda não publicado
- "Nova assistente": assistente passo a passo cria rascunho; aba "Base de conhecimento" (até 8.000 caracteres, só deste escritório).
- Publicar congela a versão (`published`); o rascunho em edição não atende no WhatsApp. É possível escolher qual assistente atende.
- Simulador real (`/api/ia/simulador`): modelo real com o rascunho; não envia e não grava a conversa; uso registrado como `simulador`.
- Testes: unitários 183/184 (`.docx` de amostra pulado); E2E da demonstração 80/81 (`/recuperar-acesso` instável no título; 3/3 isolado).
- Publicação de modelo de contrato recusa qualquer marcador `[MAIÚSCULAS]`, além de `[PENDENTE`.

## Próximos passos
1. Push de `daadc7d` e do commit seguinte; acompanhar CI e Vercel.
2. Contrato 2026.11-2: minuta em `integracoes.md`, que depende do operador e local do servidor Evolution e da confirmação do Gemini pago. Depois ligar `AI_ENABLED` e `WHATSAPP_ENABLED`.
4. Fase 4: artigos de ajuda, tours e prints sintéticos do atendimento.
5. Documentos: `inventario.md`, `matriz-requisitos.md`, `relatorio-qa.md` (QA01–QA35), `integracoes.md`, `operacao.md`.

## Pendências externas (não resolvíveis aqui)
- `responda@lexsion.com.br` sem MX: o token Cloudflare não tem permissão de Email Routing nem de DNS.
- Rotacionar todas as credenciais que foram coladas na conversa.
- InfinitePay (CNPJ ou tag) e autorização de R$ 1 para a cobrança paga; Vercel Pro para uso comercial.
- Reconciliação dos 4 contratos antigos: o titular aplica no painel.
