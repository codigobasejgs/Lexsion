# 20 — Etapa 3 de /contratar sem avanço: causa raiz e correção — 30/10/2026

## Causa raiz (não é bug: é a trava jurídica, mas sem saída para o visitante)
1. **Banco:** a única versão do modelo, `saas_contract_template_versions` `2026.10-1`, está em `REVISAO_JURIDICA`. Nenhuma versão está `PUBLICADO`.
2. **Servidor:** `src/app/api/contrato/route.ts`, função `view()`: `binding = t.status === "PUBLICADO"` → `false`. As ações `otp` e `accept` recusam com 409 `not_approved`.
3. **Tela:** `src/app/contratar/signup-form.tsx`, passo 2: o botão “Continuar para o aceite” só aparece com `srv.binding`. Sem ele, a etapa 3 ficava só com “Corrigir dados / Baixar / Imprimir”: **beco sem saída**.
4. **Texto:** a minuta tem 9 itens “[PENDENTE: …]” mais o canal de contato da contratada, que não foi configurado.

Não é feature flag: `SAAS_CHECKOUT_ENABLED=1` e os planos estão aprovados. O resumo (Profissional, 30 dias, R$ 249,90, 5 usuários) vem de `saas_plans` no banco.

## Correção (sem contornar a aprovação)
- **Saída útil na etapa 3:**
  - aviso “Contratação online em preparação”;
  - **“Avise-me quando abrir”**, com consentimento explícito: grava só nome, e-mail e plano em `saas_signup_interests`, sem conta, escritório, contrato nem cobrança;
  - “Voltar aos planos” e “Explorar a demonstração”.
- **Banco:** o trigger `saas_ctv_guard` agora **recusa aprovar ou publicar** texto que contenha “[PENDENTE”. Migration `20261030170000`.
- **Stepper dinâmico:** com teste grátis, a última etapa é “Ativação gratuita”, não “Pagamento”.
- **Documento para o(a) advogado(a):** `19-REVISAO-JURIDICA-CONTRATO.md`, com a tabela de pendências (P1–P10), opções de redação para avaliar, conferências obrigatórias, o passo a passo de aprovação e o texto integral.

## O que já funciona depois da publicação (sem novo deploy)
Ao publicar uma versão sem pendências, `binding` passa a `true`. Aí funcionam:
- o aceite com código por e-mail;
- **teste grátis:** cria a conta (convite do Supabase Auth), o escritório em `trial` com fim em 30 dias, o titular e a assinatura com limite de 5 usuários, uma única vez (pedido `teste` + `saas_activate` idempotente); envia o e-mail de boas-vindas;
- **pago:** pedido + link InfinitePay + payment_check, como já documentado em `16`.

## Status por item
| Item | GO / NO-GO | Por quê |
|---|---|---|
| Etapa 3 sem beco sem saída | **GO** | aviso + “Avise-me” + voltar |
| Contrato (aceite vinculante) | **NO-GO** | falta aprovação jurídica (P1–P10) |
| Teste grátis público | **NO-GO até publicar o contrato** | depende do contrato; o código está pronto e testado no banco |
| Checkout pago | **NO-GO** | contrato + autorização financeira + confirmação do CNPJ do recebedor + Vercel Pro |
| Primeiro login após teste | **GO técnico** | convite do Auth + escritório real; não testado ponta a ponta em produção porque depende do contrato publicado |
