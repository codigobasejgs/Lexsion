# 12 — Parecer GO / NO-GO

**Decisão: NO-GO para operar com dados reais de clientes.** O Gate 1 (fundação) está quase completo; o Gate 2 (ERP operacional) começou.

| Gate | Situação | O que falta |
|---|---|---|
| 1 — Fundação | 🟡 **Parcial alto** | Auth real ✅ · tabelas, RLS, Storage, auditoria ✅ (testados no banco real) · **falta**: teste de restauração de backup e rotação das credenciais |
| 2 — ERP operacional | 🔴 **Início** | Só login e convite de equipe usam o banco. As 75 telas internas ainda usam o armazenamento da demonstração. Próximo passo: provider de sessão real + repositórios Supabase para clientes → casos → documentos → minutas → portal |
| 3 — Integrações | 🟡 | Supabase (Auth/DB/Storage) e Resend (SMTP) **LIVE**; demais aguardam credencial ou licença (`06-…`) |
| 4 — Homologação jurídica | 🔴 | nenhum cálculo ou regra previdenciária validado por profissional |
| 5 — Produção | 🔴 | depende dos anteriores e de autorização |

**Risco atual em produção web**: nenhum — `lexsion.com.br` continua servindo a versão anterior (sem login real); esta branch não foi publicada.
