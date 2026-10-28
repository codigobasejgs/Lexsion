# 06 — Backup e recuperação

## Situação do provedor (lida em 28/10/2026)
Supabase: WAL-G **ativo**, PITR **desligado**, **nenhuma cópia diária listada ainda** (projeto novo). Não contar só com isso.

## Backup lógico próprio (testado)
```
node scripts/backup-logico.mjs <pasta FORA do repositório> --with-files
```
Gera JSON de 16 tabelas + manifesto (contagem e SHA-256) + arquivos do Storage. Recusa destino dentro do repositório.
**Contém dados pessoais**: guardar cifrado e com acesso restrito. Não copia senhas do Auth (só id/e-mail).

## Prova de restauração (cópia isolada, nunca o banco real)
```
node scripts/restaurar-teste.mjs <pasta-do-backup>
```
Aplica as migrations do repositório numa base local, carrega o backup, confere contagens por tabela, isolamento RLS e arquivos.
Resultado em 28/10: escritórios sintéticos criados → backup → apagados do banco real → restaurados na cópia: **RESTAURACAO_OK**.

## Rotina recomendada
1. Diário: backup lógico com `--with-files` para armazenamento cifrado externo; reter 30 dias.
2. Semanal: rodar `restaurar-teste.mjs` no último backup.
3. Ativar PITR no Supabase quando houver dados de clientes (plano pago).
4. Restauração real em produção: só com aprovação específica do responsável (operação irreversível sobre dados atuais).
