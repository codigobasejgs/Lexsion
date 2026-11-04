# Operação — LexSion (03/11/2026)

Infra: Vercel (app, projeto `prj_ImV6PdT5TNiFDOIlZVNxsgendEp3`), Supabase Free (banco, Auth, Storage, Realtime, pg_cron, pg_net, Vault), Cloudflare R2 (backup cifrado), Resend (e-mail). Nenhum worker permanente: todo trabalho assíncrono é **fila no banco + cron do Supabase chamando rota autenticada** (`CRON_SECRET`, guardado no Vault como `lexsion_cron_secret`).

## Rotinas agendadas (pg_cron, conferido em `cron.job`)
| Job | Agenda (UTC) | Rota | O que faz | Falha ⇒ |
|---|---|---|---|---|
| `lexsion-atendimento` | a cada minuto, só chama se há fila (ou 1×/h com WhatsApp caído) | `/api/cron/atendimento` | reprocessa `wa_events` com erro (até 5 tentativas), envia respostas vencidas, devolve ao humano trabalho preso > 3 min, avisa escritório com WhatsApp caído > 1 h | e-mail "Atendimento WhatsApp com falha" (fila morta ou presos) |
| `lexsion-inteligencia` | `7 */3 * * *` | `/api/cron/inteligencia` | coleta Câmara e Senado, deduplica, gera alertas por escritório | e-mail "Fonte jurídica sem coleta" (1 por 12 h) |
| `lexsion-cobranca` | `23 9 * * *` | `/api/cron/cobranca` | ciclo da assinatura SaaS (teste, vencimento, suspensão) e vigia do backup | e-mail "Rotina de cobrança com erro" / "Backup ausente" (> 36 h) |
| `lexsion-backup` | `17 6 * * *` | `/api/cron/backup` | backup cifrado banco + Storage ao R2 | e-mail "Backup diário falhou" |
| `lexsion-limpeza-cron` | `41 5 * * 0` | (SQL) | apaga histórico do pg_cron > 30 dias | — |

Alertas: `src/lib/ops-alert.ts` envia e-mail aos Super Admins (Resend), no máximo 1 por assunto a cada 12 h, registrado em `audit_logs` (`ops.alerta`). Responsável: Super Admin da plataforma. Sem dado de cliente no texto.

## Filas e estados
- `wa_events` (WhatsApp): `pendente → processando → feito | ignorado | erro`. Único por (instância, tipo, id do provedor). Após 5 tentativas, o evento fica em `erro` (fila morta) e gera alerta. Reprocessar: `update wa_events set status='erro', attempts=0 where id=…` (o cron pega no próximo minuto).
- `ai_jobs` (assistente): `pendente → gerando → enviando → enviado`. Saídas alternativas: `cancelado` (humano assumiu ou mensagem nova), `descartado` (portão de envio recusou), `encaminhado` (passou para humano) e `erro`.
- `conversation_control`: modo `ia | humano | pausado | resolvido` + versão. A fonte da verdade do "IA ativa" é esta tabela; o objeto da conversa só espelha.

## Backup e restauração
- Diário, cifrado na aplicação (AES-256-GCM, `BACKUP_ENCRYPTION_KEY`) e conferido na volta (decifra + SHA-256), no R2 com retenção de 30 cópias. Arquivos do Storage são incrementais.
- Cobertura: **todas as tabelas públicas** (lista em `src/lib/backup.ts`, conferida contra o catálogo do banco pelo teste `tests/real/backup.real.test.ts`). Única exceção: `saas_contract_otps`, códigos de 10 minutos guardados só como hash. Achado de 03/11: as tabelas de teste grátis/cortesia e do atendimento estavam fora; foi corrigido.
- Restaurar numa cópia isolada (nunca sobre produção):
  1. `node scripts/restaurar-do-r2.mjs <pasta> <objeto>` decifra e baixa os arquivos.
  2. `node scripts/restaurar-teste.mjs <pasta>` carrega num Postgres local (PGlite), confere contagem de cada tabela, RLS entre escritórios e documento ⇄ arquivo.
- Backup lógico avulso antes de migração: `node scripts/backup-logico.mjs <pasta-fora-do-repo>`; lê a lista viva de tabelas do banco.
- RPO observado: 24 h (backup diário). RTO: **não medido** em restauração de produção; a restauração isolada leva minutos para o volume atual.

## Migrações e rollback
- `node scripts/supabase-migrate.mjs --dry-run` (aplica e reverte numa transação) e depois `node scripts/supabase-migrate.mjs`. Backup lógico antes.
- Migrações só aditivas. Cada arquivo registra a reversão no cabeçalho. Rollback de frontend = promover o deploy anterior na Vercel; não depende de reverter migração.
- Nunca: `db reset`, `DROP`/`TRUNCATE` de dados, force-push.

## Ligar e desligar integrações
- `WHATSAPP_ENABLED=1` / `AI_ENABLED=1` na Vercel (produção) e redeploy. Vazio = desligado: o webhook responde 503 e não grava nada; IA e simulador respondem 503; a tela mostra o aviso.
- Por escritório: a IA exige `organizations.ai_enabled_at`, assistente publicada e conversa em modo `ia`. **Bloqueio de ativação:** o portão de envio não garante interrupção imediata após a tomada humana: o envio externo ocorre depois da transação e pode correr após o takeover. O limite de consumo também não é atômico. Não habilitar até corrigir e testar essas corridas.
- Desligamento de emergência: remover a variável e fazer redeploy. O cron retorna imediatamente quando WhatsApp está desligado; portanto, não há garantia de encaminhamento dos trabalhos pendentes ao humano. Conferir e tratar a fila antes de reativar.

## Rotação de credenciais (pendente: valores foram expostos em conversa)
Ordem para não derrubar o serviço. Para cada credencial: gerar a nova no provedor, gravar na Vercel (e no Vault, quando for o caso), redeploy, smoke, revogar a antiga.
1. Supabase: secret key; JWT legado, se usado.
2. Resend.
3. Cloudflare R2: access key e secret. A `BACKUP_ENCRYPTION_KEY` **não** troca sem recifrar: os backups antigos dependem dela.
4. GitHub e Vercel (tokens pessoais).
5. Evolution: a chave global é do servidor compartilhado e afeta outros sistemas; precisa de coordenação com o operador.
6. Gemini.
7. Senha da conta do proprietário.

`CRON_SECRET`: trocar na Vercel **e** no Vault (`lexsion_cron_secret`) no mesmo minuto.

## Suporte
- Saúde: `/admin` (banco, Storage, último backup, alertas) e `/admin/integracoes`.
- Logs de aplicação: Vercel → Logs. As rotas registram ações materiais em `audit_logs`, sem conteúdo jurídico.
- Smoke pós-deploy (QA35): `pnpm test:smoke` contra a URL publicada.
