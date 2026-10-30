# 09 — Parecer GO / NO-GO da operação (atualizado em 29/10/2026)

**Liberação comercial de 30/10 (versão `376a89a`):** o dono aprovou os preços e autorizou a liberação da contratação, que está **aberta ao público** com teste grátis de 30 dias. Ressalvas que seguem abertas:
1. O ciclo pagamento real → ativação ainda não foi provado com dinheiro real; acontece na 1ª mensalidade de um cliente.
2. A titularidade do CNPJ da conta InfinitePay não está confirmada.
3. Os termos não passaram por revisão jurídica.
4. O plano da Vercel é **Hobby**, que não permite uso comercial: migrar para o Pro.
5. As credenciais expostas na conversa precisam ser trocadas.

**Revisão comercial de 30/10 (tarde):**
- **Backup integral:** **GO**. Banco e arquivos do Storage têm restauração isolada comprovada (ver `15`).
- **Contratação self-service:** **NO-GO para venda**. Está implementada e testada até onde é possível sem dinheiro real, mas falta comprovar o pagamento real confirmado e a ativação do escritório. Também faltam os preços aprovados, a revisão jurídica dos termos e a confirmação do CNPJ da conta recebedora (ver `16`).
- **Operação dos escritórios já criados pela plataforma:** segue **GO condicionado**.

**Revisão de 30/10 (versões `3493086` e `f4738c4`):** **GO condicionado** mantido. Resolvidos desde a revisão anterior: MFA do Super Admin exigido no banco (B14), governança por escritório (restrições por perfil e por pessoa, aplicadas na RLS) e QA-115 (auditoria só-acréscimo; ver `14`). Seguem **sem solução no plano Free**: PITR (B13, mitigado por backup diário no R2) e arquivos do Storage fora do backup (B16). **NO-GO comercial pleno** enquanto B12 (rotação de credenciais) e B17 (contratação/cobrança) estiverem abertos.

**Revisão de 29/10 (versão `d65affd`):** mantém **GO condicionado** para os módulos centrais. Novas evidências: privilégios mínimos (13/13 em sessões reais), ciclo comercial completo (COM-01..07) passando em produção, Senado ativo. **NO-GO comercial pleno** (venda a terceiros em escala) enquanto B12 (rotação de credenciais), B14 (MFA) e B13 (PITR) não estiverem resolvidos, e enquanto cobrança e assinatura eletrônica (B2/B4) dependerem de baixa e registro manuais.

> Atualizado pela auditoria final: ver `11-RELATORIO-FINAL-AUDITORIA.md` (tabela por módulo, percentual comprovado e prontidão comercial).

**Decisão: GO para operação real dos módulos centrais**, com as ressalvas abaixo. **NO-GO** para os módulos que dependem de provedor não credenciado (ficam bloqueados na tela, sem simulação).

| Critério | Situação | Evidência |
|---|---|---|
| Isolamento entre escritórios | ✅ | RLS em 16/16 tabelas; testes de banco, integração real e E2E com API direta; mutação comprova detecção |
| Papéis e ações sensíveis no servidor | ✅ | aprovação/publicação/compartilhamento de saúde verificados no banco |
| Login, convite, recuperação | ✅ | Supabase Auth real; cadastro público fechado |
| ERP operando no banco | ✅ | clientes, casos, tarefas, agenda, prazos, documentos (Storage), minutas, CRM, propostas, contratos (registro manual), financeiro (baixa manual), equipe, configurações |
| Portal do cliente | ✅ | dados leigos pelo banco, upload ao Storage, dúvida vira tarefa, liberação pela tela |
| Super Admin | ✅ | criação real de escritório + convite, suspensão/plano por funções auditadas, consumo agregado sem conteúdo |
| Demonstração isolada | ✅ | `/demonstracao` só no navegador; falha de rede não cai na demo |
| Backup e restauração | ✅ com ressalva | backup lógico + restauração provada em cópia isolada; PITR do provedor desligado (B13) |
| Sem operação fictícia | ✅ | simulações retiradas ou bloqueadas (`03`) |
| Credenciais | ⚠️ | **rotação obrigatória** (B12) — risco aceito pelo dono ("uso agora, roto depois") |
| Cálculos jurídicos | ⚠️ | funcionam e gravam, mas são demonstrativos até validação profissional (B10) |
| Entrega de e-mail | ⚠️ | aceite pelo Resend comprovado; entrega na caixa não confirmada (B11) |

## Condições para manter o GO
1. Rotacionar todas as credenciais citadas em `10` em até 7 dias.
2. Ativar MFA na conta do dono (B14) e PITR (B13) antes de cadastrar volume relevante de clientes.
3. Rodar o backup diário e o teste de restauração semanal (`06`).
4. Não usar resultados de cálculo previdenciário como parecer sem revisão de advogado(a).
