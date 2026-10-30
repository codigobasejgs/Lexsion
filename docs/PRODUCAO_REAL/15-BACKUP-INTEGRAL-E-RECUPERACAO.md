# 15 — Backup integral (banco + Storage) e recuperação — 30/10/2026

## O que é copiado, todo dia às 06:17 UTC (`lexsion-backup` → `/api/cron/backup`)

| Parte | Como | Onde (R2 privado `lexsion`) |
|---|---|---|
| 33 tabelas do banco + contas (id/e-mail; sem senha) | JSON → gzip → AES-256-GCM, com SHA-256 por tabela no manifesto | `backups/diario/lexsion-<data>.lxbk` |
| Arquivos do Storage (`documentos`, `marcas`) | **incremental**: só arquivo novo ou alterado é baixado; cada um é cifrado à parte | `backups/arquivos/<HMAC>.lxbk` |
| Índice dos arquivos (tamanho, data e SHA-256 de cada objeto) | cifrado | `backups/arquivos/indice.lxbk` |

- **Integridade:**
  - cada arquivo novo é baixado de volta, decifrado e conferido pelo SHA-256;
  - o manifesto diário é decifrado e comparado tabela a tabela;
  - se o manifesto citar arquivo sem cópia, o backup falha ("backup incompleto").
- **Nome no R2:** é o HMAC do conteúdo com a chave, então não revela nome do arquivo, escritório nem conteúdo. Arquivo repetido não é copiado de novo.
- **Retenção:**
  - mantém os 30 manifestos mais recentes;
  - uma cópia de arquivo só é apagada quando nenhum manifesto guardado a cita mais;
  - a limpeza só roda **depois** de o backup do dia ser conferido.
- **Registro:** o resultado vai para `audit_logs`:
  - `backup.ok` com linhas, tabelas, arquivos, bytes e removidos;
  - `backup.erro` com o motivo.
- **Painel:** `/admin` mostra o último sucesso e a última falha.
- **Alertas por e-mail ao Super Admin (Resend, no máximo um a cada 12 h):**
  - falha, backup incompleto ou corrompido: alerta imediato;
  - backup **ausente** (o agendador nem rodou): a rotina diária de cobrança (06:23 BRT) confere e avisa quando passa de 36 h sem sucesso. O painel `/admin` mostra o mesmo aviso.
- **Custo:** dentro do gratuito.
  - O R2 tem 10 GB grátis; o banco atual cifrado tem ~300 KB por dia.
  - O egress do Supabase Free é de 5 GB/mês, e o modo incremental não rebaixa arquivos inalterados.

## Prova (30/10/2026, produção)
`tests/real/backup.real.test.ts`: 2/2.
1. Cria um escritório sintético com 2 arquivos reais no Storage (PDF e PNG) e os registros de arquivo no banco.
2. Faz o backup: verificado, com os 2 arquivos enviados.
3. Faz o 2º backup: **0 arquivos enviados** (incremental).
4. Confere que o objeto **não é público** no R2.
5. Roda `restaurar-do-r2.mjs`: decifra o manifesto e os 2 arquivos, com **0 divergências de SHA-256**. Os bytes restaurados são idênticos aos enviados.
6. Roda `restaurar-teste.mjs` numa **cópia isolada** (PGlite com as 38 migrations):
   - todas as tabelas com a contagem certa;
   - `arquivos do Storage: 2/2 com tamanho e SHA-256 conferidos`;
   - `banco ⇄ arquivos: 2/2 registro(s) de documento com arquivo restaurado`;
   - `RESTAURACAO_OK`.
7. Limpa tudo: escritório, arquivos e cópia restaurada no disco. Produção voltou a 0 escritórios de QA e 0 objetos.

## Recuperação (procedimento)
1. **Chave de criptografia:** `BACKUP_ENCRYPTION_KEY` (32 bytes em base64).
   - Fica na Vercel (variável cifrada) e em `.env.local`.
   - **Guarde uma 2ª cópia num cofre de senhas fora do computador.** Sem ela, nenhum backup abre, e isso não tem conserto.
   - Se a chave vazar: gere outra (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`), troque na Vercel e rode o backup. Os backups antigos continuam abrindo **só** com a chave antiga; guarde-a até expirarem (30 dias).
2. **Credenciais do R2:** o token de API S3 é criado no painel Cloudflare → R2 → Manage API tokens (permissão "Object Read & Write" só no bucket `lexsion`). Trocar = criar novo, atualizar `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` na Vercel e revogar o antigo.
3. **Ensaio (sem tocar produção):**
   ```
   node scripts/restaurar-do-r2.mjs <pasta-fora-do-repo>
   node scripts/restaurar-teste.mjs <pasta-criada>
   ```
4. **Desastre real (projeto Supabase perdido):**
   1. Crie um projeto Supabase novo e aplique as migrations: `pnpm db:migrate` com o novo `SUPABASE_PROJECT_REF`.
   2. Carregue as tabelas da pasta decifrada, na ordem do `restaurar-teste.mjs`.
   3. Envie os arquivos de `storage/<bucket>/` aos mesmos caminhos.
   4. Recrie as contas: o backup guarda id e e-mail, sem senha, então cada pessoa redefine a senha por "Recuperar acesso".
   5. Troque as URLs e chaves na Vercel e o segredo/URL do cron no Vault.

   **Isso exige aprovação do dono**: é uma operação irreversível sobre o novo projeto.

## Limites que o plano Free não elimina
- **Sem PITR:** a perda máxima é de até ~24 h (entre um backup diário e o seguinte).
- **Senhas não são copiadas:** o Supabase não exporta hash de senha pela API. Na recuperação, cada pessoa redefine a sua.
- **Upload grande:** um arquivo acima de 100 MB ainda não é enviado em partes ao R2. O limite do bucket hoje é 15 MB por arquivo.
