import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/env";
import { caudit, contractNumber, currentTemplate, hmac, newToken, planSnapshot, renderStored, sha256, supplierSnapshot } from "@/lib/saas-contract-server";
import { contractPdf } from "@/lib/contract-pdf";
import { accessHolder, officeName, partyDocument, validateParty, type Party } from "@/domain/saas-contract";
import { activate, SITE } from "@/lib/billing";
import { createCheckout } from "@/lib/infinitepay";
import { checkoutEnabled, CONTRACT_VERSION } from "@/lib/saas-catalog";

// Jornada pública do contrato SaaS (sem login): o navegador guarda só um TOKEN OPACO; o banco guarda o hash dele.
// Ações: save (cria/atualiza rascunho e devolve o texto autoritativo + hash), otp (código por e-mail), accept
// (aceite com OTP + hash conferido; gera PDF e segue para pagamento ou teste), pdf (minuta ou PDF aceito), status.
// Aceite VINCULANTE só com modelo PUBLICADO (aprovado por advogado). Sem isso: só prévia/minuta, nada é aceito.
const err = (status: number, code: string, message: string, field?: string) => NextResponse.json({ ok: false, error: { code, message, field } }, { status });
const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVED = new Set(["admin", "app", "api", "www", "portal", "demo", "lexsion", "suporte", "status", "entrar"]);
type Row = Record<string, unknown> & { id: string; number: string; status: string; party: Party; plan_snapshot: ReturnType<typeof planSnapshot>; supplier_snapshot: Awaited<ReturnType<typeof supplierSnapshot>>; cycle: "mensal" | "anual"; created_at: string; template_version_id: string; template_status_at_render: string; document_sha256: string | null; body_text: string | null; amount: number; marketing_opt_in: boolean; order_id: string | null; accepted_at: string | null; expires_at: string };

const ip = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
async function byToken(token: string): Promise<Row | null> {
  if (!/^[A-Za-z0-9_-]{30,40}$/.test(token)) return null;
  const { data } = await supabaseAdmin().from("saas_contracts").select("*").eq("session_token_sha256", sha256(token)).maybeSingle();
  return data as Row | null;
}
async function view(c: Row) {
  const db = supabaseAdmin();
  const { data: t } = await db.from("saas_contract_template_versions").select("id,version,title,status,clauses").eq("id", c.template_version_id).single();
  const binding = t!.status === "PUBLICADO";
  return { number: c.number, status: c.status, binding, templateVersion: t!.version, templateStatus: t!.status, text: c.body_text, hash: c.document_sha256, accepted_at: c.accepted_at, plan: { id: c.plan_snapshot.id, label: c.plan_snapshot.label, cycle: c.cycle, amount: c.amount, trial_days: c.plan_snapshot.trial_days, max_users: c.plan_snapshot.max_users }, holderEmail: accessHolder(c.party).email.replace(/^(.).*(@.*)$/, "$1***$2") };
}

export async function POST(req: NextRequest) {
  if (!supabaseConfigured() || !process.env.SUPABASE_SECRET_KEY) return err(503, "not_configured", "Contratação indisponível neste ambiente.");
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return err(403, "origin", "Origem não permitida.");
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return err(400, "invalid", "Requisição inválida.");
  const db = supabaseAdmin();
  const action = String(b.action ?? "");
  const token = String(b.token ?? "");

  if (action === "save") {
    // Plano, ciclo e preço resolvidos AQUI a partir do catálogo aprovado; nada de preço vem do navegador.
    const { data: p } = await db.from("saas_plans").select("*").eq("id", String(b.plan ?? "")).eq("visible", true).maybeSingle();
    if (!p || !p.approved) return err(409, "plan_unavailable", "Plano indisponível. Escolha outro plano.", "plan");
    const cycle = b.cycle === "anual" ? "anual" : "mensal";
    const amount = cycle === "anual" ? p.price_yearly : p.price_monthly;
    if (!amount) return err(409, "plan_unavailable", "Ciclo não oferecido para este plano.", "cycle");
    const party = b.party as Party;
    const v = party && typeof party === "object" ? validateParty(party) : { kind: "Dados inválidos." };
    const slug = String(b.slug ?? "").trim().toLowerCase();
    if (!SLUG.test(slug) || RESERVED.has(slug)) v.slug = "Endereço: 3 a 40 letras minúsculas, números ou hífen (não reservado).";
    else if ((await db.from("organizations").select("id").eq("slug", slug).maybeSingle()).data) v.slug = "Este endereço já está em uso. Escolha outro.";
    if (Object.keys(v).length) return NextResponse.json({ ok: false, error: { code: "invalid", message: "Corrija os campos indicados.", fields: v } }, { status: 400 });
    const tpl = await currentTemplate();
    const supplier = await supplierSnapshot();
    const plan = planSnapshot(p);
    let c = token ? await byToken(token) : null;
    if (c && c.status !== "DRAFT" && c.status !== "READY_FOR_REVIEW") return err(409, "locked", "Este contrato já foi aceito e não pode ser alterado. Para outra contratação, recomece.");
    let outToken = token;
    const clean = JSON.parse(JSON.stringify(party)) as Party;
    if (!c) {
      const fp = hmac(ip(req)).slice(0, 32);
      const { count } = await db.from("saas_contract_audit").select("id", { count: "exact", head: true }).eq("action", "contrato.criado").eq("detail", fp).gte("at", new Date(Date.now() - 3_600_000).toISOString());
      if ((count ?? 0) >= 8) return err(429, "rate", "Muitas tentativas. Tente novamente em uma hora.");
      outToken = newToken();
      const number = contractNumber();
      const created_at = new Date().toISOString();
      const r = renderStored(tpl, { supplier, party: clean, plan, cycle, number, created_at, binding: tpl.status === "PUBLICADO" });
      const { data, error } = await db.from("saas_contracts").insert({ number, session_token_sha256: sha256(outToken), status: "READY_FOR_REVIEW", template_version_id: tpl.id, template_status_at_render: tpl.status, plan_id: p.id, cycle, amount, plan_snapshot: plan, supplier_snapshot: supplier, party: { ...clean, slug }, body_text: r.text, document_sha256: r.hash, marketing_opt_in: b.marketing === true, created_at }).select("*").single();
      if (error || !data) return err(500, "save_failed", "Não foi possível gerar a prévia agora.");
      c = data as Row;
      await caudit(c.id, "contrato.criado", fp, null, tpl.id);
    } else {
      // Qualquer alteração gera novo texto e novo hash: o aceite anterior (se houvesse código enviado) deixa de valer.
      const r = renderStored(tpl, { supplier, party: clean, plan, cycle, number: c.number, created_at: c.created_at, binding: tpl.status === "PUBLICADO" });
      const changed = r.hash !== c.document_sha256;
      const { data } = await db.from("saas_contracts").update({ template_version_id: tpl.id, template_status_at_render: tpl.status, plan_id: p.id, cycle, amount, plan_snapshot: plan, supplier_snapshot: supplier, party: { ...clean, slug }, body_text: r.text, document_sha256: r.hash, marketing_opt_in: b.marketing === true, status: "READY_FOR_REVIEW", updated_at: new Date().toISOString() }).eq("id", c.id).in("status", ["DRAFT", "READY_FOR_REVIEW"]).select("*").single();
      c = data as Row;
      if (changed) { await db.from("saas_contract_otps").update({ used_at: new Date().toISOString() }).eq("contract_id", c.id).is("used_at", null); await caudit(c.id, "contrato.atualizado", "dados alterados: novo hash, código anterior invalidado", null, tpl.id); }
    }
    return NextResponse.json({ ok: true, data: { token: outToken, ...(await view(c)) } });
  }

  const c = await byToken(token);
  if (!c) return err(404, "not_found", "Contratação não encontrada ou expirada. Recomece pelo plano.");
  if (new Date(c.expires_at) < new Date() && !c.accepted_at) return err(410, "expired", "Esta prévia expirou (7 dias). Recomece pelo plano.");

  if (action === "status") return NextResponse.json({ ok: true, data: await view(c) });

  if (action === "pdf") {
    // Antes do aceite: minuta com tarja (gerada na hora). Depois: os MESMOS bytes guardados no aceite.
    if (c.accepted_at) {
      const { data: f } = await db.from("saas_contract_files").select("storage_path,sha256").eq("contract_id", c.id).eq("kind", "contrato_aceito").single();
      const { data: blob } = await db.storage.from("contratos-saas").download(f!.storage_path);
      const buf = Buffer.from(await blob!.arrayBuffer());
      if (sha256(buf) !== f!.sha256) return err(500, "integrity", "Falha de integridade do arquivo. A equipe LexSion foi avisada.");
      return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="contrato-lexsion-${c.number}.pdf"`, "Cache-Control": "no-store" } });
    }
    const pdf = await contractPdf({ text: c.body_text!, number: c.number, hash: c.document_sha256!, footer: `Minuta não aceita · Contrato ${c.number}` });
    return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="minuta-lexsion-${c.number}.pdf"`, "Cache-Control": "no-store" } });
  }

  if (action === "otp") {
    const { binding } = await view(c);
    if (!binding) return err(409, "not_approved", "O contrato ainda está em revisão jurídica. O aceite será liberado após a aprovação.");
    if (c.status !== "READY_FOR_REVIEW") return err(409, "locked", "Este contrato já foi aceito.");
    if (b.hash !== c.document_sha256) return err(409, "stale", "O contrato mudou desde a sua leitura. Revise a versão atual.");
    const { count } = await db.from("saas_contract_otps").select("id", { count: "exact", head: true }).eq("contract_id", c.id).gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
    if ((count ?? 0) >= 5) return err(429, "rate", "Limite de códigos atingido. Tente novamente em uma hora.");
    const { data: last } = await db.from("saas_contract_otps").select("created_at").eq("contract_id", c.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (last && Date.now() - Date.parse(last.created_at) < 60_000) return err(429, "wait", "Aguarde 1 minuto para pedir outro código.");
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const h = accessHolder(c.party);
    await db.from("saas_contract_otps").update({ used_at: new Date().toISOString() }).eq("contract_id", c.id).is("used_at", null);
    const { data: otp } = await db.from("saas_contract_otps").insert({ contract_id: c.id, email: h.email, code_hash: hmac(`${c.id}:${code}`), document_sha256: c.document_sha256, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() }).select("id").single();
    const key = process.env.RESEND_API_KEY;
    const r = key ? await fetch("https://api.resend.com/emails", { method: "POST", signal: AbortSignal.timeout(20_000), headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "LexSion <nao-responda@lexsion.com.br>", to: [h.email], subject: `Código de aceite do contrato LexSion ${c.number}`, text: `Seu código para aceitar o contrato ${c.number} é: ${code}\n\nVale por 10 minutos e só para a versão do contrato que você está lendo.\nSe você não pediu, ignore esta mensagem.\n(Mensagem automática; não responda.)` }) }).catch(() => null) : null;
    await caudit(c.id, "aceite.codigo_enviado", r?.ok ? "e-mail aceito pelo Resend" : `envio falhou (HTTP ${r?.status ?? "sem chave"})`);
    if (!r?.ok) { await db.from("saas_contract_otps").update({ used_at: new Date().toISOString() }).eq("id", otp!.id); return err(502, "email_failed", "Não foi possível enviar o código agora. Tente de novo em instantes."); }
    return NextResponse.json({ ok: true, data: { sentTo: h.email.replace(/^(.).*(@.*)$/, "$1***$2"), expiresInMin: 10 } });
  }

  if (action === "accept") {
    const v = await view(c);
    if (!v.binding) return err(409, "not_approved", "O contrato ainda está em revisão jurídica.");
    if (b.read !== true || b.agree !== true) return err(400, "consent", "Confirme a leitura e o aceite (caixas não vêm marcadas).", "agree");
    if (b.hash !== c.document_sha256) return err(409, "stale", "O contrato mudou desde a sua leitura. Revise a versão atual.");
    if (c.accepted_at) return NextResponse.json({ ok: true, data: { ...v, next: await nextStep(c, req) } }); // idempotente
    const { data: otp } = await db.from("saas_contract_otps").select("*").eq("contract_id", c.id).is("used_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!otp || new Date(otp.expires_at) < new Date() || otp.document_sha256 !== c.document_sha256) return err(400, "otp_expired", "Código expirado ou de outra versão. Peça um novo código.", "otp");
    if (otp.attempts >= 5) { await db.from("saas_contract_otps").update({ used_at: new Date().toISOString() }).eq("id", otp.id); return err(429, "otp_locked", "Tentativas esgotadas. Peça um novo código.", "otp"); }
    const ok = crypto.timingSafeEqual(Buffer.from(hmac(`${c.id}:${String(b.otp ?? "").replace(/\D/g, "")}`)), Buffer.from(otp.code_hash));
    if (!ok) { await db.from("saas_contract_otps").update({ attempts: otp.attempts + 1 }).eq("id", otp.id); return err(400, "otp_invalid", "Código incorreto.", "otp"); }
    // Consome o código ANTES do aceite (replay: o mesmo código não serve duas vezes).
    const { data: burned } = await db.from("saas_contract_otps").update({ used_at: new Date().toISOString() }).eq("id", otp.id).is("used_at", null).select("id");
    if (!burned?.length) return err(409, "otp_used", "Código já utilizado.", "otp");
    const h = accessHolder(c.party);
    const acceptedAt = new Date().toISOString();
    const { error: aErr } = await db.from("saas_contract_acceptances").insert({ contract_id: c.id, document_sha256: c.document_sha256, template_version_id: c.template_version_id, accepted_at: acceptedAt, email: h.email, signer_name: h.name, signer_document_last4: h.document.slice(-4), ip_hash: hmac(ip(req)).slice(0, 32), user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300), otp_id: otp.id });
    if (aErr && aErr.code !== "23505") return err(500, "accept_failed", "Não foi possível registrar o aceite agora.");
    const { data: won } = await db.from("saas_contracts").update({ status: "TERMS_ACCEPTED", accepted_at: acceptedAt, updated_at: acceptedAt }).eq("id", c.id).eq("status", "READY_FOR_REVIEW").select("*").maybeSingle();
    const cur = (won ?? (await byToken(token))) as Row;
    if (won) {
      const evidence = [`Aceito eletronicamente em ${new Date(acceptedAt).toISOString()} (UTC) por ${h.name} (CPF final ${h.document.slice(-4)}), e-mail ${h.email}, com código de uso único enviado a esse e-mail.`, `Método: clickwrap com confirmação por código (OTP). Não é assinatura qualificada ICP-Brasil.`, `Modelo ${v.templateVersion} · SHA-256 do texto aceito: ${c.document_sha256}`];
      const pdf = await contractPdf({ text: c.body_text!, number: c.number, hash: c.document_sha256!, footer: `Contrato ${c.number} aceito em ${new Date(acceptedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, evidence });
      const path = `${c.number}/contrato-aceito.pdf`;
      const up = await db.storage.from("contratos-saas").upload(path, pdf, { contentType: "application/pdf", upsert: false });
      if (!up.error) await db.from("saas_contract_files").insert({ contract_id: c.id, kind: "contrato_aceito", storage_path: path, sha256: sha256(pdf), bytes: pdf.length });
      await caudit(c.id, "aceite.registrado", `hash ${c.document_sha256!.slice(0, 16)}…, modelo ${v.templateVersion}${up.error ? "; PDF NÃO armazenado" : "; PDF armazenado"}`);
    }
    return NextResponse.json({ ok: true, data: { ...(await view(cur)), next: await nextStep(cur, req) } });
  }
  return err(400, "action", "Ação desconhecida.");
}

/** Depois do aceite: teste grátis (cria o escritório sem cobrança) ou pagamento (link InfinitePay). Idempotente. */
async function nextStep(c: Row, req: NextRequest): Promise<{ kind: "trial" | "payment" | "blocked"; url?: string; message?: string; activation?: string | null }> {
  const db = supabaseAdmin();
  if (!checkoutEnabled()) return { kind: "blocked", message: "Aceite registrado. A contratação online está temporariamente desligada; a equipe LexSion entrará em contato." };
  if (c.order_id) {
    const { data: o } = await db.from("saas_orders").select("order_nsu,status,checkout_url,activation").eq("id", c.order_id).single();
    if (o?.status === "teste") return { kind: "trial", activation: o.activation };
    if (o?.status === "pendente" && o.checkout_url) return { kind: "payment", url: o.checkout_url };
    return { kind: "blocked", message: `Pedido ${o?.status ?? "indisponível"}.` };
  }
  const h = accessHolder(c.party);
  const party = c.party as Party & { slug: string };
  const customer = { name: h.name, email: h.email, office: officeName(c.party), slug: party.slug, document: partyDocument(c.party), phone: h.phone };
  const trial = c.plan_snapshot.trial_days > 0;
  const fp = hmac(ip(req)).slice(0, 32);
  const { data: o, error } = await db.from("saas_orders").insert({
    plan_id: c.plan_snapshot.id, cycle: c.cycle, amount: c.amount, plan_snapshot: c.plan_snapshot, customer, contract_version: CONTRACT_VERSION, contract_accepted_at: c.accepted_at, contract_id: c.id, request_fingerprint: fp,
    status: trial ? "teste" : "pendente", expires_at: trial ? null : new Date(Date.now() + 24 * 3_600_000).toISOString(),
    history: [{ at: new Date().toISOString(), text: `Contrato ${c.number} aceito; ${trial ? `teste grátis de ${c.plan_snapshot.trial_days} dias` : "aguardando pagamento"}` }],
  }).select("id,order_nsu").single();
  if (error?.code === "23505") return { kind: "blocked", message: trial ? "Este CPF/CNPJ ou e-mail já usou o teste grátis, ou o endereço já tem cadastro em andamento. Fale com a LexSion." : "Já existe um cadastro em andamento para este endereço." };
  if (error || !o) return { kind: "blocked", message: "Não foi possível registrar o pedido agora. Tente de novo." };
  await db.from("saas_contracts").update({ order_id: o.id, status: trial ? "PAYMENT_CONFIRMED" : "PAYMENT_PENDING", updated_at: new Date().toISOString() }).eq("id", c.id);
  if (trial) {
    const a = await activate(o.order_nsu);
    const { data: ord } = await db.from("saas_orders").select("organization_id").eq("id", o.id).single();
    if (ord?.organization_id) await db.from("saas_contracts").update({ organization_id: ord.organization_id, status: "ACTIVE" }).eq("id", c.id);
    return { kind: "trial", activation: a };
  }
  try {
    const url = await createCheckout({ orderNsu: o.order_nsu, items: [{ quantity: 1, price: c.amount, description: `LexSion ${c.plan_snapshot.label} — ${c.cycle === "anual" ? "12 meses" : "1 mês"} (contrato ${c.number})` }],
      redirectUrl: `${SITE}/contratar/retorno`, webhookUrl: `${SITE}/api/infinitepay/webhook`, customer: { name: h.name, email: h.email }, validUntil: new Date(Date.now() + 24 * 3_600_000).toISOString() });
    await db.from("saas_orders").update({ checkout_url: url }).eq("id", o.id);
    return { kind: "payment", url };
  } catch {
    await db.from("saas_orders").update({ status: "cancelado" }).eq("id", o.id);
    await db.from("saas_contracts").update({ order_id: null, status: "TERMS_ACCEPTED" }).eq("id", c.id);
    return { kind: "blocked", message: "Não foi possível abrir o pagamento agora. Nada foi cobrado; tente de novo." };
  }
}
