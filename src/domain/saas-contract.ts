// Contrato SaaS LexSion (contratada ⇄ escritório). Puro: usado pela prévia ao vivo (navegador) e pelo servidor
// (texto autoritativo + hash). NÃO confundir com os contratos que o escritório firma com os próprios clientes.
//
// Versão 2026.11-1: decisões do proprietário (03/11/2026) aplicadas. Sem aprovação manual: o modelo não tem pendência
// fixa; as condições da plataforma (CONDITIONS) vêm da configuração e, se faltarem, o texto renderizado mostra
// “[PENDENTE: campo]” e o servidor não abre o aceite (diagnóstico exato no Super Admin).
import { isValidCnpj, isValidCpf } from "./crm";

export type Clause = { n: string; title: string; body: string };
export type TemplateVersion = { id?: string; version: string; title: string; status: string; clauses: Clause[] };
export type Supplier = { trade_name: string; legal_name: string; document: string; legal_nature: string; address: { street: string; number: string; district: string; city: string; uf: string; cep: string }; contact_email: string | null; contact_phone: string | null; conditions?: Partial<Record<ConditionKey, string>> };

/**
 * Condições da PLATAFORMA que o texto usa (não são dados do contratante nem do plano). Preenchidas uma vez pelo
 * Super Admin (saas_supplier_profile.conditions) e copiadas no snapshot de cada contrato. Enquanto alguma faltar,
 * o texto mostra “[PENDENTE: …]” daquele campo, o aceite não abre e o Super Admin vê exatamente qual campo falta.
 */
export const CONDITIONS = {
  acesso_tecnico: { label: "Acesso técnico à infraestrutura (Anexo III.5)", hint: "Quem detém o acesso técnico direto (banco/chaves de serviço) e como o sigilo é formalizado." },
  resend_local: { label: "Resend: localização do tratamento (Anexo III.7-d)", hint: "Ex.: Estados Unidos (conforme painel/termos da Resend)." },
  infinitepay_papel: { label: "InfinitePay: papel e localização (Anexo III.7-e)", hint: "Suboperadora ou controladora independente dos dados de pagamento; país do tratamento." },
  transferencia: { label: "Transferência internacional (Anexo III.9)", hint: "Mecanismo do art. 33 da LGPD e hipótese legal, por fornecedor (Supabase, Vercel, Cloudflare, Resend)." },
} as const;
export type ConditionKey = keyof typeof CONDITIONS;
/** Campos de configuração que faltam para o texto ficar completo (diagnóstico do Super Admin). */
export const missingConditions = (s: Pick<Supplier, "conditions" | "contact_email">) => [
  ...(s.contact_email ? [] : [{ key: "contact_email", label: "E-mail oficial de atendimento e comunicações contratuais" }]),
  ...(Object.keys(CONDITIONS) as ConditionKey[]).filter((k) => !s.conditions?.[k]?.trim()).map((k) => ({ key: k, label: CONDITIONS[k].label })),
];
export type Address = { cep: string; street: string; number: string; complement?: string; district: string; city: string; uf: string };
export type Party =
  | { kind: "PF"; name: string; cpf: string; email: string; phone: string; oab?: string; trade_name?: string; address: Address }
  | { kind: "PJ"; legal_name: string; trade_name?: string; cnpj: string; address: Address; rep: { name: string; cpf: string; role: string; email: string; phone: string; oab?: string }; rep_powers: boolean };
export type PlanSnap = { id: string; label: string; version: number; price_monthly: number; price_yearly: number | null; max_users: number; trial_days: number; features: { label: string; ok: boolean }[] };
export type RenderCtx = { supplier: Supplier; party: Party; plan: PlanSnap; cycle: "mensal" | "anual"; number: string; date: string; templateVersion: string; draft: boolean };

export const CONTRACT_TITLE = "CONTRATO ELETRÔNICO DE LICENÇA DE USO E PRESTAÇÃO DE SERVIÇOS DE SOFTWARE COMO SERVIÇO (SaaS) — LEXSION";
export const DRAFT_BANNER = "MINUTA PARA REVISÃO — AINDA NÃO ACEITA";
const UF = new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));
const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d),)/g, ".")}`;
const digits = (s: string) => (s ?? "").replace(/\D/g, "");
const fmtCpf = (s: string) => digits(s).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
const fmtCnpj = (s: string) => digits(s).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
const fmtCep = (s: string) => digits(s).replace(/^(\d{5})(\d{3})$/, "$1-$2");
export const fmtAddress = (a: Partial<Address>) => [`${a.street ?? ""}, ${a.number ?? ""}${a.complement ? `, ${a.complement}` : ""}`, a.district, `${a.city ?? ""}/${a.uf ?? ""}`, `CEP ${fmtCep(a.cep ?? "")}`].filter((x) => x && !/^[,/ ]*$/.test(x)).join(", ");

/** Validação do contratante (mesma no navegador e no servidor). Retorna { campo: mensagem }. */
export function validateParty(p: Party): Record<string, string> {
  const e: Record<string, string> = {};
  const email = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
  const phone = (s: string) => /^\d{10,11}$/.test(digits(s));
  const addr = (a: Address | undefined) => {
    if (!a || !/^\d{8}$/.test(digits(a.cep))) e["address.cep"] = "CEP com 8 dígitos.";
    if (!a?.street || a.street.trim().length < 3) e["address.street"] = "Informe o logradouro.";
    if (!a?.number?.trim()) e["address.number"] = "Informe o número (ou S/N).";
    if (!a?.district || a.district.trim().length < 2) e["address.district"] = "Informe o bairro.";
    if (!a?.city || a.city.trim().length < 2) e["address.city"] = "Informe a cidade.";
    if (!a?.uf || !UF.has(a.uf.toUpperCase())) e["address.uf"] = "UF inválida.";
  };
  if (p.kind === "PF") {
    if (!p.name || p.name.trim().split(/\s+/).length < 2) e.name = "Nome completo (nome e sobrenome).";
    if (!isValidCpf(p.cpf ?? "")) e.cpf = "CPF inválido.";
    if (!email.test(p.email ?? "")) e.email = "E-mail inválido.";
    if (!phone(p.phone ?? "")) e.phone = "Celular com DDD (10 ou 11 dígitos).";
    if (p.oab && !/^\d{1,7}\/?[A-Za-z]{2}$/.test(p.oab.replace(/\s/g, ""))) e.oab = "Formato da OAB: número/UF (ex.: 123456/SP).";
    addr(p.address);
  } else if (p.kind === "PJ") {
    if (!p.legal_name || p.legal_name.trim().length < 3) e.legal_name = "Informe a razão social.";
    if (!isValidCnpj(p.cnpj ?? "")) e.cnpj = "CNPJ inválido.";
    addr(p.address);
    const r = p.rep;
    if (!r?.name || r.name.trim().split(/\s+/).length < 2) e["rep.name"] = "Nome completo do(a) responsável legal.";
    if (!isValidCpf(r?.cpf ?? "")) e["rep.cpf"] = "CPF do(a) responsável inválido.";
    if (!r?.role || r.role.trim().length < 3) e["rep.role"] = "Informe o cargo/função (ex.: sócio-administrador).";
    if (!email.test(r?.email ?? "")) e["rep.email"] = "E-mail inválido.";
    if (!phone(r?.phone ?? "")) e["rep.phone"] = "Celular com DDD.";
    if (r?.oab && !/^\d{1,7}\/?[A-Za-z]{2}$/.test(r.oab.replace(/\s/g, ""))) e["rep.oab"] = "Formato da OAB: número/UF.";
    if (p.rep_powers !== true) e.rep_powers = "Confirme que o(a) responsável tem poderes para contratar.";
  } else e.kind = "Escolha pessoa física ou jurídica.";
  return e;
}

/** Quem recebe o acesso de titular (e o código de aceite): PF = a própria pessoa; PJ = responsável legal. */
export const accessHolder = (p: Party) => (p.kind === "PF" ? { name: p.name.trim(), email: p.email.trim().toLowerCase(), document: digits(p.cpf), phone: digits(p.phone) } : { name: p.rep.name.trim(), email: p.rep.email.trim().toLowerCase(), document: digits(p.rep.cpf), phone: digits(p.rep.phone) });
export const officeName = (p: Party) => (p.kind === "PF" ? (p.trade_name?.trim() || p.name.trim()) : (p.trade_name?.trim() || p.legal_name.trim()));
export const partyDocument = (p: Party) => (p.kind === "PF" ? digits(p.cpf) : digits(p.cnpj));

function qualification(p: Party): string {
  if (p.kind === "PF") return `${p.name || "[NOME COMPLETO]"}, pessoa física, inscrita no CPF sob o nº ${fmtCpf(p.cpf) || "[CPF]"}${p.oab ? `, advogado(a) com inscrição informada na OAB nº ${p.oab.toUpperCase()} (informação declarada, não verificada junto à OAB)` : ""}${p.trade_name ? `, que utiliza o nome comercial “${p.trade_name}”` : ""}, com endereço em ${fmtAddress(p.address) || "[ENDEREÇO]"}, e-mail ${p.email || "[E-MAIL]"}`;
  return `${p.legal_name || "[RAZÃO SOCIAL]"}${p.trade_name ? ` (nome fantasia “${p.trade_name}”)` : ""}, pessoa jurídica inscrita no CNPJ sob o nº ${fmtCnpj(p.cnpj) || "[CNPJ]"}, com sede em ${fmtAddress(p.address) || "[ENDEREÇO]"}, neste ato representada por ${p.rep?.name || "[REPRESENTANTE]"}, ${p.rep?.role || "[CARGO]"}, CPF nº ${fmtCpf(p.rep?.cpf ?? "") || "[CPF]"}${p.rep?.oab ? `, OAB nº ${p.rep.oab.toUpperCase()} (informada)` : ""}, e-mail ${p.rep?.email || "[E-MAIL]"}, que declara ter poderes para contratar em nome da pessoa jurídica`;
}

/** Valores que entram no texto (campo → texto). Exportado para teste e para o quadro-resumo. */
export function fields(c: RenderCtx): Record<string, string> {
  const s = c.supplier, a = s.address;
  const price = c.cycle === "anual" && c.plan.price_yearly ? c.plan.price_yearly : c.plan.price_monthly;
  const on = c.plan.features.filter((f) => f.ok).map((f) => f.label), off = c.plan.features.filter((f) => !f.ok).map((f) => f.label);
  return {
    "contratada.qualificacao": `${s.legal_name}, ${s.legal_nature.toLowerCase().startsWith("empres") ? "empresário individual" : s.legal_nature}, inscrito no CNPJ sob o nº ${s.document}, com endereço em ${s.address.street}, ${a.number}, ${a.district}, ${a.city}/${a.uf}, CEP ${a.cep}, fornecedor da plataforma comercial “${s.trade_name}”${s.contact_email ? `, e-mail para comunicações contratuais ${s.contact_email}` : ""}`,
    "contratada.nome": s.legal_name,
    "contratada.contato": s.contact_email ? `${s.contact_email}${s.contact_phone ? ` / ${s.contact_phone}` : ""}` : "[PENDENTE: canal oficial de atendimento e comunicações contratuais a ser configurado pela CONTRATADA]",
    ...Object.fromEntries((Object.keys(CONDITIONS) as ConditionKey[]).map((k) => [`condicao.${k}`, s.conditions?.[k]?.trim() || `[PENDENTE: ${CONDITIONS[k].label} — configurar em Super Admin → Contratos SaaS]`])),
    "contratante.qualificacao": qualification(c.party),
    "contratante.nome": c.party.kind === "PF" ? c.party.name : c.party.legal_name,
    "plano.nome": c.plan.label,
    "plano.versao": String(c.plan.version),
    "plano.ciclo": c.cycle === "anual" ? "anual (12 meses)" : "mensal",
    "plano.valor": brl(price),
    "plano.usuarios": `${c.plan.max_users} ${c.plan.max_users === 1 ? "usuário" : "usuários"}`,
    "plano.teste": c.plan.trial_days > 0 ? `período de teste gratuito de ${c.plan.trial_days} dias, sem cobrança e sem cadastro de cartão; a primeira cobrança, no valor acima, é enviada por link antes do fim do teste` : "sem período de teste gratuito; a primeira cobrança ocorre na contratação",
    "plano.recursos_ativos": on.length ? on.join("; ") : "[nenhum recurso listado]",
    "plano.recursos_nao_ativos": off.length ? off.join("; ") : "nenhum",
    "cobranca.modalidade": "cobrança periódica por link de pagamento emitido a cada período (Pix ou cartão, pela InfinitePay); NÃO há débito automático nem recorrência automática no cartão",
    "contrato.numero": c.number,
    "contrato.versao": c.templateVersion,
    "contrato.data": c.date,
  };
}

/** Texto integral do contrato (o que é lido, aceito e assinado pelo hash). */
export function renderContract(t: Pick<TemplateVersion, "title" | "clauses">, c: RenderCtx): string {
  const f = fields(c);
  const fill = (s: string) => s.replace(/\{\{([a-z_.]+)\}\}/g, (_, k: string) => f[k] ?? `[${k}]`);
  const head = [t.title || CONTRACT_TITLE, `Nº ${c.number} · Versão do modelo ${c.templateVersion} · ${c.date}`, ...(c.draft ? [DRAFT_BANNER] : [])];
  return [...head, "", ...t.clauses.flatMap((cl) => [`${cl.n ? `${cl.n}. ` : ""}${cl.title}`.toUpperCase(), fill(cl.body), ""])].join("\n").trim();
}

/** Modelo-base v2026.11-1. Placeholders {{…}} vêm de fields(). */
export const DEFAULT_TEMPLATE: TemplateVersion = {
  version: "2026.11-1", title: CONTRACT_TITLE, status: "REVISAO_JURIDICA",
  clauses: [
    { n: "", title: "Partes", body: "CONTRATADA: {{contratada.qualificacao}}.\nCONTRATANTE: {{contratante.qualificacao}}.\nAs partes celebram este contrato, que se rege pelas cláusulas a seguir e pelo Quadro-Resumo (Anexo I)." },
    { n: "1", title: "Objeto", body: "1.1. Licença de uso limitada, não exclusiva, intransferível e revogável nos termos deste contrato, para acesso pela internet (navegador e aplicativo instalável/PWA) ao software de gestão jurídica LexSion, no modelo de assinatura (SaaS), para uso interno e lícito do escritório da CONTRATANTE, com os módulos do plano contratado.\n1.2. Este contrato não transfere propriedade de código-fonte, não inclui hospedagem dedicada nem garante resultado jurídico de qualquer natureza." },
    { n: "2", title: "Plano, preço e ciclo", body: "2.1. Plano {{plano.nome}} (versão comercial {{plano.versao}}), ciclo {{plano.ciclo}}, valor de {{plano.valor}} por ciclo, com até {{plano.usuarios}}.\n2.2. Condição inicial: {{plano.teste}}.\n2.3. Modalidade de cobrança: {{cobranca.modalidade}}.\n2.4. O preço contratado fica congelado neste documento. Alteração de tabela vale apenas para novas contratações ou para renovação, mediante aviso prévio de 30 (trinta) dias, enviado ao e-mail do titular.\n2.5. Não há cobrança de excedentes: o limite de usuários é aplicado pelo sistema, e a ampliação depende de troca de plano." },
    { n: "3", title: "Ativação, acesso e usuários", body: "3.1. O ambiente do escritório é criado após a confirmação do pagamento pela InfinitePay ou, havendo teste gratuito, após o aceite deste contrato. O acesso de titular é enviado ao e-mail indicado no cadastro.\n3.2. A CONTRATANTE designa e retira os acessos de sua equipe, define papéis e permissões e responde pelo uso feito com as credenciais de seus membros.\n3.3. A identidade visual do escritório (marca própria) e o aplicativo instalável (PWA) são configurados pela CONTRATANTE dentro da plataforma." },
    { n: "4", title: "Funcionalidades incluídas e serviços de terceiros", body: "4.1. Recursos ativos no plano na data deste contrato: {{plano.recursos_ativos}}.\n4.2. Recursos NÃO ativos nesta data (não integram o objeto até sua disponibilização formal): {{plano.recursos_nao_ativos}}.\n4.3. Recursos que dependem de terceiros (por exemplo: WhatsApp, inteligência artificial, fontes legislativas e de jurisprudência, assinatura eletrônica, cobrança online de honorários) estão sujeitos à disponibilidade, licenças, limites e eventual cobrança desses terceiros, não sendo prometidos como plenamente operacionais quando não homologados.\n4.4. Cálculos previdenciários e demais cálculos têm natureza demonstrativa até validação profissional, conforme Anexo II." },
    { n: "5", title: "Limites da informação e responsabilidade profissional", body: "5.1. A LexSion é ferramenta de apoio administrativo e jurídico. Pesquisas, resumos, minutas, monitoramento legislativo e cálculos exigem verificação humana das fontes, premissas e legislação aplicável.\n5.2. O sistema não substitui o(a) advogado(a), não representa a CONTRATANTE em juízo e não garante êxito, cumprimento de prazo processual ou atualização instantânea de fontes externas." },
    { n: "6", title: "Obrigações da CONTRATADA", body: "6.1. Disponibilizar os recursos ativos do plano, manter os controles de segurança descritos na cláusula 14 e prestar atendimento pelo canal {{contratada.contato}}.\n6.2. Suporte: a CONTRATADA disponibilizará atendimento de suporte por e-mail, em dias úteis, por meio do canal oficial informado neste contrato. Não é prometido prazo fixo de resposta, de resolução ou nível de disponibilidade (SLA) que não esteja efetivamente contratado e operacionalizado." },
    { n: "7", title: "Obrigações da CONTRATANTE", body: "7.1. Usar o sistema de forma lícita; manter dados cadastrais corretos; guardar o sigilo das credenciais; respeitar a LGPD e o sigilo profissional; gerir sua equipe; usar a automação de atendimento com responsabilidade; não compartilhar acessos indevidamente.\n7.2. Observar as normas da OAB aplicáveis à publicidade e ao marketing jurídico." },
    { n: "8", title: "Pagamentos, renovação e inadimplência", body: "8.1. A cada período, a cobrança do período seguinte é emitida por link e enviada ao e-mail do titular com antecedência de 7 (sete) dias do vencimento.\n8.2. Sem pagamento até 5 (cinco) dias após o vencimento, o acesso é suspenso, sem exclusão de dados, e reativado após a confirmação do pagamento.\n8.3. Não há multa, juros nem correção monetária por atraso: o atraso gera apenas a suspensão prevista em 8.2, sem exclusão de dados." },
    { n: "9", title: "Cancelamento, rescisão e arrependimento", body: "9.1. A CONTRATANTE pode cancelar a qualquer tempo pela própria plataforma (Configurações > Assinatura), com efeito ao fim do período já pago.\n9.2. Não há reembolso proporcional do período em curso, ressalvado o direito de arrependimento previsto em 9.3.\n9.3. Direito de arrependimento: em até 7 (sete) dias da primeira contratação, a CONTRATANTE pode desistir, com devolução integral do valor pago (art. 49 do Código de Defesa do Consumidor). Nada neste contrato afasta direitos legais irrenunciáveis.\n9.4. Nos descumprimentos contratuais passíveis de correção, a rescisão depende de notificação formal, enviada ao e-mail cadastrado ou registrada na plataforma, com prazo de 10 (dez) dias corridos, contado do envio, para regularização. O atraso de pagamento segue a cláusula 8: pode ocasionar a suspensão do acesso, sem multa nem juros." },
    { n: "10", title: "Dados pessoais, LGPD e sigilo profissional", body: "10.1. Quanto aos dados dos clientes e processos que insere, a CONTRATANTE é controladora e a CONTRATADA atua como operadora, tratando-os apenas para prestar o serviço.\n10.2. Quanto aos dados cadastrais e de faturamento da própria CONTRATANTE, a CONTRATADA é controladora, para as finalidades de contratação, cobrança, segurança e cumprimento legal.\n10.3. A administração da plataforma não tem permissão para ler documentos e dados jurídicos dos escritórios por meio das funções comerciais e de faturamento.\n10.4. Suboperadores e detalhes do tratamento: Anexo III. Comunicação de incidentes: pelo canal {{contratada.contato}}, nos termos da lei." },
    { n: "11", title: "Armazenamento, backups, retenção e portabilidade", body: "11.1. Os dados são armazenados em infraestrutura de nuvem (Supabase), com cópia de segurança diária cifrada em provedor distinto (Cloudflare R2). Não há recuperação de ponto exato no tempo (PITR): a perda máxima em caso de desastre é de até aproximadamente 24 (vinte e quatro) horas.\n11.2. A CONTRATANTE pode exportar seus dados pelas funções disponíveis na plataforma.\n11.3. Encerrada a contratação, os dados ficam preservados por 90 (noventa) dias, para exportação ou reativação; depois desse prazo, podem ser eliminados pelo procedimento do Anexo III (item III.12)." },
    { n: "12", title: "Propriedade intelectual e marcas", body: "12.1. O software, sua marca LexSion e componentes são de titularidade da CONTRATADA ou de seus licenciantes, nos termos dos documentos de titularidade aplicáveis.\n12.2. A CONTRATANTE mantém os direitos sobre o conteúdo que insere e autoriza a exibição de sua marca no próprio ambiente, apenas para a prestação do serviço." },
    { n: "13", title: "Terceiros e integrações", body: "13.1. O serviço depende de terceiros, entre eles: Supabase (banco de dados e autenticação), Vercel (hospedagem), Cloudflare (cópias de segurança), Resend (e-mails) e InfinitePay (pagamentos). As integrações de WhatsApp e de inteligência artificial não estão ativas para dados de clientes nesta versão; sua ativação depende de nova versão deste contrato e do Anexo III.\n13.2. Não há promessa de acesso a sistemas de tribunais, do INSS ou a bases privadas sem a respectiva autorização ou licença." },
    { n: "14", title: "Segurança e incidentes", body: "14.1. A plataforma utiliza autenticação por credenciais individuais, controle de sessões e mecanismos de autorização baseados em papéis e permissões. O acesso aos dados é segregado por escritório, com controles de segurança e registros de auditoria, conforme os recursos efetivamente implementados e disponibilizados na plataforma. As cópias de segurança são cifradas.\n14.2. A CONTRATANTE responde pela segurança das contas de sua equipe e deve comunicar imediatamente suspeita de acesso indevido." },
    { n: "15", title: "Comunicações", body: "15.1. Comunicações contratuais, de cobrança e de alterações relevantes são enviadas ao e-mail do titular cadastrado e ficam registradas.\n15.2. Comunicações de marketing dependem de consentimento próprio, separado deste contrato e revogável a qualquer tempo." },
    { n: "16", title: "Vigência, alterações e documentos", body: "16.1. Vigência a partir do aceite eletrônico, por prazo indeterminado, renovando-se a cada ciclo pago.\n16.2. Integram este contrato: o Quadro-Resumo (Anexo I), os avisos do Anexo II, o Anexo III, a Política de Privacidade e os Termos de Uso publicados.\n16.3. Alterações relevantes deste contrato exigem nova versão e novo aceite; a versão aceita não é substituída silenciosamente." },
    { n: "17", title: "Aceite eletrônico e integridade", body: "17.1. O aceite é feito por meio eletrônico (clickwrap): leitura do texto integral, confirmação expressa e código de uso único enviado ao e-mail do titular. São registrados data e hora (UTC), versão do modelo, impressão digital SHA-256 do texto aceito, e-mail, identificação do navegador e um código derivado do endereço IP.\n17.2. As partes reconhecem esse meio como apto à comprovação de autoria e integridade, nos termos do art. 10, § 2º, da MP 2.200-2/2001, sem que isso caracterize assinatura qualificada ICP-Brasil. A cópia em PDF é disponibilizada à CONTRATANTE após o aceite." },
    { n: "18", title: "Solução de controvérsias e foro", body: "18.1. As partes buscarão solução amigável pelo canal {{contratada.contato}}.\n18.2. Nas relações de consumo, quando caracterizadas, fica resguardado ao consumidor o foro de seu domicílio, na forma da legislação aplicável. Nas demais relações, fica eleito o foro da comarca do domicílio ou sede da CONTRATADA, conforme indicado em sua qualificação neste contrato, desde que observada a pertinência exigida pelo art. 63 do Código de Processo Civil." },
    { n: "Anexo I", title: "Quadro-resumo da contratação", body: "Contrato nº {{contrato.numero}} · modelo {{contrato.versao}} · {{contrato.data}}.\nContratada: {{contratada.nome}}.\nContratante: {{contratante.nome}}.\nPlano: {{plano.nome}} (versão {{plano.versao}}) · ciclo {{plano.ciclo}} · {{plano.valor}} por ciclo · até {{plano.usuarios}}.\nCondição inicial: {{plano.teste}}.\nCobrança: {{cobranca.modalidade}}.\nRecursos ativos: {{plano.recursos_ativos}}.\nRecursos não ativos: {{plano.recursos_nao_ativos}}." },
    { n: "Anexo II", title: "Avisos sobre serviços jurídicos, IA e limites técnicos", body: "Informações legislativas são coletadas de fontes oficiais (Câmara dos Deputados e Senado Federal) e podem ter atraso. Quando a inteligência artificial for ativada, suas sugestões exigirão revisão humana antes de qualquer uso. Cálculos são demonstrativos até validação profissional. Integrações dependem de licenças e credenciais de terceiros." },
    { n: "Anexo III", title: "Acordo de tratamento de dados pessoais", body: "III.1. Papéis. Nos dados pessoais que a CONTRATANTE insere ou recebe pela plataforma (clientes, partes, representantes, dependentes, usuários da equipe, processos e documentos), a CONTRATANTE é controladora e a CONTRATADA é operadora (cláusula 10.1). Nos dados cadastrais, de contratação e de faturamento da própria CONTRATANTE, a CONTRATADA é controladora (cláusula 10.2).\nIII.2. Objeto e finalidade. A CONTRATADA trata esses dados somente para prestar o serviço contratado: armazenar, organizar, exibir, processar e transmitir os dados conforme as funções usadas pela CONTRATANTE, gerar cópias de segurança e manter registros de segurança e de auditoria.\nIII.3. Titulares e categorias de dados. Titulares: clientes e partes atendidos pela CONTRATANTE, seus representantes e dependentes, e os usuários da equipe da CONTRATANTE. Categorias: dados de identificação, contato e endereço; dados processuais; documentos e anotações inseridos pela CONTRATANTE; registros de acesso e de auditoria. A CONTRATANTE pode inserir dados pessoais sensíveis (por exemplo, de saúde), dados de crianças e adolescentes e dados relativos a processos criminais, sob sua responsabilidade como controladora e com a base legal aplicável.\nIII.4. Instruções do controlador. Este contrato e as configurações feitas pela CONTRATANTE na plataforma constituem as instruções documentadas da controladora. A CONTRATADA não trata os dados para finalidade própria e não os utiliza para treinar modelos de inteligência artificial. Nesta versão, as integrações de inteligência artificial e de WhatsApp não estão ativas para dados de clientes.\nIII.5. Confidencialidade e acesso. As funções de administração da plataforma (comerciais, de suporte e de faturamento) não exibem o conteúdo jurídico dos escritórios, como documentos, processos e cadastros de clientes. O acesso técnico direto à infraestrutura (banco de dados e chaves de serviço) permite, tecnicamente, acesso a todos os dados e é usado somente para manutenção, segurança, cópias de segurança, exportação e eliminação a pedido e cumprimento de obrigação legal, sujeito a dever de sigilo. {{condicao.acesso_tecnico}}\nIII.6. Medidas de segurança. A CONTRATADA mantém as seguintes medidas, efetivamente implementadas na data desta versão: (a) isolamento dos dados por escritório no banco, por políticas de acesso por linha; (b) controle de acesso por papéis e permissões; (c) autenticação por credenciais individuais, com controle de sessões; (d) tráfego cifrado por HTTPS/TLS; (e) cópia de segurança diária do banco e dos arquivos, cifrada pela própria aplicação com AES-256-GCM antes do envio a provedor distinto e conferida após o envio; (f) registros de auditoria das ações administrativas, das exportações, das eliminações e dos aceites contratuais, estes sem possibilidade de alteração. A criptografia do armazenamento principal (banco e arquivos) é a fornecida pela infraestrutura do provedor, sem camada adicional da aplicação.\nIII.7. Suboperadores. Participam do tratamento, na data desta versão: (a) Supabase — banco de dados, autenticação e armazenamento de arquivos; todos os dados da plataforma; Estados Unidos (região us-east-1). (b) Vercel — hospedagem e execução da aplicação; dados em trânsito nas requisições e registros técnicos de acesso; Estados Unidos (região iad1). (c) Cloudflare (R2) — guarda das cópias de segurança, recebidas já cifradas pela aplicação; América do Norte. (d) Resend — envio de e-mails transacionais (códigos de aceite, convites, avisos e cobranças); nome, e-mail e conteúdo das mensagens. Localização: {{condicao.resend_local}}. (e) InfinitePay (CloudWalk) — pagamento das assinaturas; nome e e-mail do titular, valor e identificação do pedido. Papel e localização: {{condicao.infinitepay_papel}}.\nIII.8. Alteração de suboperadores. A inclusão ou substituição de suboperador que trate dados da CONTRATANTE será comunicada ao e-mail do titular antes de entrar em uso, salvo necessidade urgente de segurança, caso em que a comunicação ocorrerá logo em seguida.\nIII.9. Transferência internacional. O uso de suboperadores nos Estados Unidos caracteriza transferência internacional de dados (art. 33 da LGPD). {{condicao.transferencia}}\nIII.10. Incidentes de segurança. A CONTRATADA comunicará à CONTRATANTE, que atua como controladora dos dados tratados em seu escritório, sem demora injustificada e no prazo máximo de 1 (um) dia útil contado do conhecimento, o incidente de segurança que possa afetar dados pessoais. A comunicação inicial poderá ser preliminar, mesmo que a apuração ainda não esteja completa, e será complementada conforme novas informações forem confirmadas. A comunicação é feita ao e-mail do titular; a CONTRATANTE pode contatar a CONTRATADA pelo canal {{contratada.contato}}. A CONTRATADA mantém registro auditável de cada incidente, com a data de conhecimento, os dados potencialmente afetados, as medidas de contenção e as atualizações. Esta obrigação contratual da operadora não se confunde com a obrigação legal da controladora de comunicar a ANPD e os titulares, quando aplicável, nos termos da Resolução CD/ANPD nº 15/2024.\nIII.11. Exportação e direitos dos titulares. O titular do escritório pode gerar, pela plataforma (Configurações > Dados e LGPD), a exportação integral dos dados do escritório: dados estruturados em JSON e documentos e arquivos privados nas extensões originais, com manifesto, entregue por link temporário e registrada na trilha de auditoria. Essa exportação do escritório não se confunde com os direitos individuais dos titulares (art. 18 da LGPD), atendidos pela CONTRATANTE como controladora; pedidos de titulares recebidos pela CONTRATADA serão encaminhados à CONTRATANTE, e a plataforma permite consultar, corrigir e excluir registros.\nIII.12. Retenção, devolução e eliminação. Encerrada a contratação — ao fim do período já pago, quando houver —, os dados ficam preservados por 90 (noventa) dias, prazo em que a CONTRATANTE pode solicitar a exportação pelo canal {{contratada.contato}} ou reativar a assinatura. Depois desse prazo, o escritório fica elegível à eliminação, feita individualmente, com confirmação humana reforçada e registro do responsável, da data, do escopo e do resultado, nunca de forma automática ou em massa. A eliminação alcança os registros do escritório no banco e seus arquivos no armazenamento privado. Ficam preservados, por obrigação legal ou exercício regular de direitos, os contratos SaaS, os aceites e os registros de pagamento. As cópias de segurança cifradas que contenham os dados eliminados são substituídas em ciclo de 30 (trinta) cópias diárias; até lá, permanecem cifradas e só são usadas para recuperação de desastre.\nIII.13. Término do tratamento. Encerrado o contrato, a CONTRATADA deixa de tratar os dados, exceto para a guarda prevista no item III.12, o cumprimento de obrigação legal ou o exercício regular de direitos." },
  ],
};

/** Lista de pendências “[PENDENTE: …]” remanescentes no texto (checklist jurídico). */
export const pendingItems = (t: Pick<TemplateVersion, "clauses">) => t.clauses.flatMap((c) => [...c.body.matchAll(/\[PENDENTE: ([^\]]+)\]/g)].map((m) => `${c.n ? `Cláusula ${c.n}` : c.title}: ${m[1]}`));
