// Contrato SaaS LexSion (contratada ⇄ escritório). Puro: usado pela prévia ao vivo (navegador) e pelo servidor
// (texto autoritativo + hash). NÃO confundir com os contratos que o escritório firma com os próprios clientes.
//
// ponytail: a minuta abaixo é ESPECIFICAÇÃO TÉCNICA para revisão por advogado(a); itens que dependem de decisão
// do proprietário/advogado aparecem como “[PENDENTE: …]” e o aceite público só abre com versão PUBLICADA no banco.
import { isValidCnpj, isValidCpf } from "./crm";

export type Clause = { n: string; title: string; body: string };
export type TemplateVersion = { id?: string; version: string; title: string; status: string; clauses: Clause[] };
export type Supplier = { trade_name: string; legal_name: string; document: string; legal_nature: string; address: { street: string; number: string; district: string; city: string; uf: string; cep: string }; contact_email: string | null; contact_phone: string | null };
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

/** Minuta-base v2026.10-1 (EM REVISÃO JURÍDICA). Placeholders {{…}} vêm de fields(). */
export const DEFAULT_TEMPLATE: TemplateVersion = {
  version: "2026.10-1", title: CONTRACT_TITLE, status: "REVISAO_JURIDICA",
  clauses: [
    { n: "", title: "Partes", body: "CONTRATADA: {{contratada.qualificacao}}.\nCONTRATANTE: {{contratante.qualificacao}}.\nAs partes celebram este contrato, que se rege pelas cláusulas a seguir e pelo Quadro-Resumo (Anexo I)." },
    { n: "1", title: "Objeto", body: "1.1. Licença de uso limitada, não exclusiva, intransferível e revogável nos termos deste contrato, para acesso pela internet (navegador e aplicativo instalável/PWA) ao software de gestão jurídica LexSion, no modelo de assinatura (SaaS), para uso interno e lícito do escritório da CONTRATANTE, com os módulos do plano contratado.\n1.2. Este contrato não transfere propriedade de código-fonte, não inclui hospedagem dedicada nem garante resultado jurídico de qualquer natureza." },
    { n: "2", title: "Plano, preço e ciclo", body: "2.1. Plano {{plano.nome}} (versão comercial {{plano.versao}}), ciclo {{plano.ciclo}}, valor de {{plano.valor}} por ciclo, com até {{plano.usuarios}}.\n2.2. Condição inicial: {{plano.teste}}.\n2.3. Modalidade de cobrança: {{cobranca.modalidade}}.\n2.4. O preço contratado fica congelado neste documento. Alteração de tabela vale apenas para novas contratações ou para renovação, mediante aviso prévio de [PENDENTE: prazo de aviso de reajuste].\n2.5. Não há cobrança de excedentes: o limite de usuários é aplicado pelo sistema, e a ampliação depende de troca de plano." },
    { n: "3", title: "Ativação, acesso e usuários", body: "3.1. O ambiente do escritório é criado após a confirmação do pagamento pela InfinitePay ou, havendo teste gratuito, após o aceite deste contrato. O acesso de titular é enviado ao e-mail indicado no cadastro.\n3.2. A CONTRATANTE designa e retira os acessos de sua equipe, define papéis e permissões e responde pelo uso feito com as credenciais de seus membros.\n3.3. A identidade visual do escritório (marca própria) e o aplicativo instalável (PWA) são configurados pela CONTRATANTE dentro da plataforma." },
    { n: "4", title: "Funcionalidades incluídas e serviços de terceiros", body: "4.1. Recursos ativos no plano na data deste contrato: {{plano.recursos_ativos}}.\n4.2. Recursos NÃO ativos nesta data (não integram o objeto até sua disponibilização formal): {{plano.recursos_nao_ativos}}.\n4.3. Recursos que dependem de terceiros (por exemplo: WhatsApp, inteligência artificial, fontes legislativas e de jurisprudência, assinatura eletrônica, cobrança online de honorários) estão sujeitos à disponibilidade, licenças, limites e eventual cobrança desses terceiros, não sendo prometidos como plenamente operacionais quando não homologados.\n4.4. Cálculos previdenciários e demais cálculos têm natureza demonstrativa até validação profissional, conforme Anexo II." },
    { n: "5", title: "Limites da informação e responsabilidade profissional", body: "5.1. A LexSion é ferramenta de apoio administrativo e jurídico. Pesquisas, resumos, minutas, monitoramento legislativo e cálculos exigem verificação humana das fontes, premissas e legislação aplicável.\n5.2. O sistema não substitui o(a) advogado(a), não representa a CONTRATANTE em juízo e não garante êxito, cumprimento de prazo processual ou atualização instantânea de fontes externas." },
    { n: "6", title: "Obrigações da CONTRATADA", body: "6.1. Disponibilizar os recursos ativos do plano, manter controles de segurança (isolamento entre escritórios, verificação em duas etapas para a administração da plataforma, trilha de auditoria) e prestar atendimento pelo canal {{contratada.contato}}.\n6.2. Nível de serviço (disponibilidade e prazos de atendimento): [PENDENTE: política de suporte e SLA a aprovar; nenhuma meta de disponibilidade é prometida nesta minuta]." },
    { n: "7", title: "Obrigações da CONTRATANTE", body: "7.1. Usar o sistema de forma lícita; manter dados cadastrais corretos; guardar o sigilo das credenciais; respeitar a LGPD e o sigilo profissional; gerir sua equipe; usar a automação de atendimento com responsabilidade; não compartilhar acessos indevidamente.\n7.2. Observar as normas da OAB aplicáveis à publicidade e ao marketing jurídico." },
    { n: "8", title: "Pagamentos, renovação e inadimplência", body: "8.1. A cada período, a cobrança do período seguinte é emitida por link e enviada ao e-mail do titular com antecedência de 7 (sete) dias do vencimento.\n8.2. Sem pagamento até 5 (cinco) dias após o vencimento, o acesso é suspenso, sem exclusão de dados, e reativado após a confirmação do pagamento.\n8.3. Encargos por atraso: [PENDENTE: multa, juros e correção, se houver, a definir; nenhum encargo é cobrado enquanto não definido]." },
    { n: "9", title: "Cancelamento, rescisão e arrependimento", body: "9.1. A CONTRATANTE pode cancelar a qualquer tempo pela própria plataforma (Configurações > Assinatura), com efeito ao fim do período já pago.\n9.2. Reembolso de período em curso: [PENDENTE: política de reembolso a definir].\n9.3. Direito de arrependimento (art. 49 do CDC), quando aplicável à contratação: [PENDENTE: análise jurídica de aplicabilidade conforme o perfil da CONTRATANTE]. Nada neste contrato afasta direitos legais irrenunciáveis.\n9.4. A rescisão por descumprimento depende de notificação prévia com prazo para regularização: [PENDENTE: prazo]." },
    { n: "10", title: "Dados pessoais, LGPD e sigilo profissional", body: "10.1. Quanto aos dados dos clientes e processos que insere, a CONTRATANTE é controladora e a CONTRATADA atua como operadora, tratando-os apenas para prestar o serviço.\n10.2. Quanto aos dados cadastrais e de faturamento da própria CONTRATANTE, a CONTRATADA é controladora, para as finalidades de contratação, cobrança, segurança e cumprimento legal.\n10.3. A administração da plataforma não tem permissão para ler documentos e dados jurídicos dos escritórios por meio das funções comerciais e de faturamento.\n10.4. Suboperadores e detalhes do tratamento: Anexo III. Comunicação de incidentes: pelo canal {{contratada.contato}}, nos termos da lei." },
    { n: "11", title: "Armazenamento, backups, retenção e portabilidade", body: "11.1. Os dados são armazenados em infraestrutura de nuvem (Supabase), com cópia de segurança diária cifrada em provedor distinto (Cloudflare R2). Não há recuperação de ponto exato no tempo (PITR): a perda máxima em caso de desastre é de até aproximadamente 24 (vinte e quatro) horas.\n11.2. A CONTRATANTE pode exportar seus dados pelas funções disponíveis na plataforma.\n11.3. Prazo de retenção após o encerramento e procedimento de eliminação: [PENDENTE: política de retenção a aprovar]." },
    { n: "12", title: "Propriedade intelectual e marcas", body: "12.1. O software, sua marca LexSion e componentes são de titularidade da CONTRATADA ou de seus licenciantes, nos termos dos documentos de titularidade aplicáveis.\n12.2. A CONTRATANTE mantém os direitos sobre o conteúdo que insere e autoriza a exibição de sua marca no próprio ambiente, apenas para a prestação do serviço." },
    { n: "13", title: "Terceiros e integrações", body: "13.1. O serviço depende de terceiros, entre eles: Supabase (banco de dados e autenticação), Vercel (hospedagem), Cloudflare (cópias de segurança), Resend (e-mails), InfinitePay (pagamentos) e, quando ativados pela CONTRATANTE, provedores de WhatsApp e de inteligência artificial.\n13.2. Não há promessa de acesso a sistemas de tribunais, do INSS ou a bases privadas sem a respectiva autorização ou licença." },
    { n: "14", title: "Segurança e incidentes", body: "14.1. Isolamento de dados por escritório no banco (políticas de acesso por linha), verificação em duas etapas obrigatória para a administração da plataforma, trilha de auditoria e cópias de segurança cifradas.\n14.2. A CONTRATANTE responde pela segurança das contas de sua equipe e deve comunicar imediatamente suspeita de acesso indevido." },
    { n: "15", title: "Comunicações", body: "15.1. Comunicações contratuais, de cobrança e de alterações relevantes são enviadas ao e-mail do titular cadastrado e ficam registradas.\n15.2. Comunicações de marketing dependem de consentimento próprio, separado deste contrato e revogável a qualquer tempo." },
    { n: "16", title: "Vigência, alterações e documentos", body: "16.1. Vigência a partir do aceite eletrônico, por prazo indeterminado, renovando-se a cada ciclo pago.\n16.2. Integram este contrato: o Quadro-Resumo (Anexo I), os avisos do Anexo II, o Anexo III, a Política de Privacidade e os Termos de Uso publicados.\n16.3. Alterações relevantes deste contrato exigem nova versão e novo aceite; a versão aceita não é substituída silenciosamente." },
    { n: "17", title: "Aceite eletrônico e integridade", body: "17.1. O aceite é feito por meio eletrônico (clickwrap): leitura do texto integral, confirmação expressa e código de uso único enviado ao e-mail do titular. São registrados data e hora (UTC), versão do modelo, impressão digital SHA-256 do texto aceito, e-mail, identificação do navegador e um código derivado do endereço IP.\n17.2. As partes reconhecem esse meio como apto à comprovação de autoria e integridade, nos termos do art. 10, § 2º, da MP 2.200-2/2001, sem que isso caracterize assinatura qualificada ICP-Brasil. A cópia em PDF é disponibilizada à CONTRATANTE após o aceite." },
    { n: "18", title: "Solução de controvérsias e foro", body: "18.1. As partes buscarão solução amigável pelo canal {{contratada.contato}}.\n18.2. Foro: [PENDENTE: cláusula de foro a definir em revisão jurídica, observadas as normas de proteção ao consumidor quando aplicáveis]." },
    { n: "Anexo I", title: "Quadro-resumo da contratação", body: "Contrato nº {{contrato.numero}} · modelo {{contrato.versao}} · {{contrato.data}}.\nContratada: {{contratada.nome}}.\nContratante: {{contratante.nome}}.\nPlano: {{plano.nome}} (versão {{plano.versao}}) · ciclo {{plano.ciclo}} · {{plano.valor}} por ciclo · até {{plano.usuarios}}.\nCondição inicial: {{plano.teste}}.\nCobrança: {{cobranca.modalidade}}.\nRecursos ativos: {{plano.recursos_ativos}}.\nRecursos não ativos: {{plano.recursos_nao_ativos}}." },
    { n: "Anexo II", title: "Avisos sobre serviços jurídicos, IA e limites técnicos", body: "Informações legislativas são coletadas de fontes oficiais (Câmara dos Deputados e Senado Federal) e podem ter atraso. Sugestões de inteligência artificial exigem revisão humana antes de qualquer uso. Cálculos são demonstrativos até validação profissional. Integrações dependem de licenças e credenciais de terceiros." },
    { n: "Anexo III", title: "Tratamento de dados e suboperadores", body: "[PENDENTE: acordo de tratamento de dados (DPA) a aprovar.] Suboperadores atuais: Supabase (banco de dados e autenticação, EUA), Vercel (hospedagem, EUA), Cloudflare (cópias de segurança), Resend (e-mails), InfinitePay (pagamentos, Brasil) e, quando ativados, provedores de WhatsApp e de inteligência artificial." },
  ],
};

/** Lista de pendências “[PENDENTE: …]” remanescentes no texto (checklist jurídico). */
export const pendingItems = (t: Pick<TemplateVersion, "clauses">) => t.clauses.flatMap((c) => [...c.body.matchAll(/\[PENDENTE: ([^\]]+)\]/g)].map((m) => `${c.n ? `Cláusula ${c.n}` : c.title}: ${m[1]}`));
