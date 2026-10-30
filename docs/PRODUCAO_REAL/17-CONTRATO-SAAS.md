# 17 — Contrato SaaS dinâmico na contratação — 30/10/2026

## Estado em uma linha
A jornada (plano → dados → contrato → aceite → pagamento/teste) está **implementada e publicada**. O contrato aparece completo e personalizado **antes** de qualquer pagamento. O **aceite vinculante está bloqueado** porque a minuta está **pendente de aprovação jurídica**. Enquanto isso, a página mostra a minuta com tarja e não coleta aceite nem cobra.

> Efeito colateral importante: com o contrato obrigatório, **ninguém contrata pelo site até a versão ser publicada**. O teste grátis liberado antes também passa a exigir o aceite. Isso segue a regra “não coletar aceite vinculante de texto não aprovado”.

## 1. Auditoria: o que existia e o que foi feito
| Requisito | Antes | Agora | Arquivo |
|---|---|---|---|
| Plano resolvido no servidor pelo slug | EXISTE (`/contratar`) | mantido; slug inválido oferece os planos | `src/app/contratar/page.tsx` |
| Contrato dentro da jornada | AUSENTE (só checkbox para `/termos`) | prévia viva + revisão do texto do servidor + PDF | `signup-form.tsx`, `src/domain/saas-contract.ts` |
| PF e PJ com responsável legal | PARCIAL (nome/CPF-CNPJ) | PF (OAB opcional) e PJ (razão social, CNPJ, representante, declaração de poderes), endereço com CEP | `validateParty` |
| Modelos versionados com aprovação jurídica | AUSENTE | `saas_contract_template_versions`: RASCUNHO → REVISAO_JURIDICA → APROVADO → PUBLICADO → ARQUIVADO; trigger garante imutabilidade e exige nome/OAB do(a) advogado(a) | migration `20261030140000` |
| Snapshots e hash | PARCIAL (snapshot do plano no pedido) | snapshot da contratada, do contratante, do plano e da versão; SHA-256 do texto; qualquer edição gera novo hash e invalida o código | `saas_contracts` |
| Aceite comprovável | AUSENTE | clickwrap + OTP por e-mail (Resend), uso único, 10 min, preso ao hash, 5 tentativas, 1 envio por minuto, 5 por hora; evidências mínimas (UTC, e-mail, nome, 4 últimos dígitos do CPF, HMAC do IP, user-agent); tabela só-acréscimo | `/api/contrato`, `saas_contract_acceptances` |
| PDF A4 no servidor | AUSENTE | pdf-lib com texto selecionável, cabeçalho, rodapé, paginação e hash; minuta com tarja; PDF aceito gravado uma vez no bucket privado `contratos-saas` (o download devolve os mesmos bytes, conferidos por SHA-256) | `src/lib/contract-pdf.ts` |
| Ordem contrato → pagamento → acesso | PARCIAL | pedido só nasce de contrato aceito (`saas_orders.contract_id`); a rota antiga `/api/contratar` foi removida | `nextStep()` |
| Super Admin > Contratos SaaS | AUSENTE | lista; download auditado; modelos (ver, criar versão com motivo, enviar para revisão, aprovar com nome/OAB, publicar); dados da contratada; checklist | `/admin/contratos` |
| Titular > Meu contrato | AUSENTE | lista e PDF do próprio escritório (RLS) | `owner-subscription.tsx`, `/api/assinatura/contrato` |
| Backup dos artefatos | AUSENTE | tabelas `saas_contract_*` e bucket `contratos-saas` no backup integral do R2 | `backup.ts`, migration `20261030150000` |
| Ajuda | AUSENTE | artigo “Como contratar a LexSion e aceitar o contrato”, com prints reais | `src/content/help.ts` |
| Assinatura por provedor (ZapSign) | BLOQUEADO | sem credencial: nunca aparece “assinado”, só “aceite eletrônico registrado” | — |

## 2. Dados da CONTRATADA usados (fonte: comprovante de CNPJ do proprietário)
- **Nome empresarial:** 59.760.458 MARCO ANTONIO BOGGIAN. **CNPJ:** 59.760.458/0001-91.
- **Natureza:** empresário individual (213-5), ME.
- **Endereço:** Rua Jacques Pilon, 189, Vila Piauí, São Paulo/SP, CEP 05109-160.
- **Marca:** “LexSion — ERP Jurídico SaaS”, usada como nome comercial, sem substituir o nome empresarial e sem “LTDA”.
- **Contato contratual:** **não preenchido**. O e-mail e o telefone do comprovante não foram usados como canal de suporte. O texto mostra “[PENDENTE: canal oficial …]” até o Super Admin configurar.
- **Conferência cadastral** (atualidade na Receita) e **atividade fiscal** (a atividade principal no comprovante é treinamento em informática): ficam no checklist do Super Admin para o contador. Não concluí nenhuma irregularidade.
- **Os comprovantes não foram encontrados no disco:** `REFERENCIAS/comprovante-cnpj-contratada.pdf`, `REFERENCIAS/modelo-visual-contrato.*` e `MINUTA_CONTRATO_SAAS_LEXSION_PARA_REVISAO_JURIDICA.md` não existem no pacote. Usei os dados escritos no prompt e uma minuta-base própria. Nada foi copiado do App Correspondência.

## 3. Modelo de contrato
- **Versão `2026.10-1`, status REVISAO_JURIDICA:** 18 cláusulas + Anexos I a III, conforme a estrutura pedida.
- **Pendências explícitas no texto** (marcadas “[PENDENTE: …]” e listadas no Super Admin):
  - aviso de reajuste;
  - encargos por atraso;
  - reembolso;
  - aplicabilidade do art. 49 do CDC;
  - prazo de notificação para rescisão;
  - SLA e política de suporte;
  - retenção após o encerramento;
  - foro;
  - DPA;
  - canal de contato.
- **O que o texto não promete:** uptime, atendimento 24/7, multa de 2%, juros de 1%, IGP-M, fidelidade nem “assinatura ICP-Brasil”.
- **O que o texto declara:** a ausência de PITR (perda de até ~24 h), a cobrança por link sem débito automático e os recursos **não ativos**.
- **Publicação:**
  1. O(a) advogado(a) aprova, informando nome e OAB e declarando a revisão.
  2. O checklist precisa estar completo e a conferência cadastral, registrada.
  3. Só então “Publicar” fica disponível.
- Contratos já aceitos guardam o próprio texto e não mudam.

## 4. Exemplos (dados sintéticos)
`evidencias/contrato/exemplo-pf.pdf` e `exemplo-pj.pdf`, com 4 páginas A4 cada, renderizadas página a página em `exemplo-*-pagina-*.png`. A verificação com pdf.js encontrou a contratada correta, a tarja de minuta, o Anexo III, 0 itens de texto além da margem e 4/4 rodapés com “Página X de Y”.

| Exemplo | SHA-256 do texto | SHA-256 do PDF |
|---|---|---|
| PF | `600aa3a4ee735f7c…f78c5` | `d341081ff68133e9…5555` |
| PJ | `08611581116b39a2…45cd` | `80210dbf2edad303…2382` |

**Prints:** `antes-contratar-{390,768,1440}.png` × `depois-{1-plano,2-dados,3-contrato}-{390,768,1440}.png`.

## 5. Testes
- **Unidade** (`tests/unit/saas-contract.test.ts`, 11/11):
  - validação PF/PJ;
  - contratada correta, sem LTDA nem APP GROUP;
  - PF sem CNPJ e PJ com representante;
  - plano, preço, recursos e modalidade de cobrança no texto;
  - nenhum placeholder sobrando nem promessa proibida;
  - tarja de minuta;
  - hash muda com qualquer dado;
  - pendências declaradas;
  - PDF A4 multipágina.
- **Banco** (`tests/db/contrato-saas.test.ts`, 7/7):
  - fluxo de status sem pular etapa, com aprovação exigindo OAB;
  - publicado imutável e indelével; só uma versão publicada;
  - aceite único e só-acréscimo; arquivos e auditoria também só-acréscimo;
  - RLS: titular A ≠ B, advogado e anônimo sem acesso, plataforma vê tudo;
  - navegador não escreve; OTP ilegível; bucket privado.
- **E2E** (`tests/e2e/contrato.spec.ts`, 12/12 local, repetido 2×):
  - os 3 planos e slug inválido;
  - prévia ao vivo com a contratada;
  - validação por campo; poderes da PJ desmarcados por padrão;
  - texto do servidor com número e hash; sem aceite nem pagamento enquanto pendente;
  - download da minuta em PDF; voltar preserva os dados;
  - API recusa token forjado e ignora preço enviado pelo navegador;
  - 320 px sem rolagem horizontal.
- **Não testado com dados reais (de propósito):**
  - aceite com OTP real: depende do modelo publicado; a cobertura está nas regras de banco e no código;
  - assinatura por provedor: sem credencial;
  - pagamento real: não autorizado.
- **Rascunhos dos testes:** usam e-mail `@lexsion-qa.invalid` e são apagados ao final. Produção: 0 contratos.

## 6. Decisões pendentes (dono, advogado, contador, provedor)
1. **Advogado(a):** revisar e aprovar a minuta `2026.10-1` (ou ajustar) e decidir as 10 pendências do item 3; confirmar se o clickwrap com OTP basta para o modelo B2B/PF.
2. **Dono:** canal oficial de contato contratual (e-mail monitorado); registrar a conferência cadastral do CNPJ.
3. **Contador(a):** CNAE e emissão fiscal para licenciamento SaaS (a atividade principal é treinamento em informática).
4. **InfinitePay:** confirmar no App que `$marco-boggian` está no CNPJ 59.760.458/0001-91; criar a API Key (recomendado).
5. **Assinatura formal** (opcional): credencial ZapSign ou outro provedor, se o advogado exigir assinatura além do aceite.
6. **Pagamento real controlado:** autorizar uma transação de teste para provar o ciclo pagamento → ativação.
7. **Vercel Pro:** o plano Hobby não permite uso comercial.

## 7. Reversão
- **Migrations aditivas:** `20261030140000` e `20261030150000`. Para reverter, apague as tabelas `saas_contract_*` e `saas_supplier_profile` e o bucket `contratos-saas`.
- **Backup lógico** feito antes da migration: `_backups/lexsion-2026-10-30T16-51-37-177Z`.
- **Código:** reverter o commit volta a `/contratar` sem contrato. Isso reabre a contratação sem aceite, **não recomendado**.
