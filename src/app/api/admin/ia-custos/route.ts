import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Controle financeiro da IA (Super Admin, módulo "Financeiro da plataforma"). Só números agregados: nenhum conteúdo.
// Alterações (limites, chave-mestra do OCR, confirmação do faturamento, custo apurado) exigem superadmin e são auditadas.
const err = (status: number, message: string) => NextResponse.json({ ok: false, error: { message } }, { status });

async function who(write: boolean) {
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const [{ data: plat }, { data: mod }] = await Promise.all([
    sb.rpc("is_platform", { roles: write ? ["superadmin"] : ["superadmin", "platform_admin", "platform_finance", "platform_auditor"] }),
    sb.rpc("platform_module_ok", { p_module: "financeiro" }),
  ]);
  return plat === true && mod === true ? auth.user : null;
}

export async function GET() {
  if (!(await who(false))) return err(403, "Somente a administração da plataforma.");
  const db = supabaseAdmin();
  const now = new Date();
  const m0 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const d30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const rows: { organization_id: string; module: string; model: string; purpose: string; pages: number; input_tokens: number | null; output_tokens: number | null; cost_usd: number; estimated: boolean; status: string; key_owner: string; at: string; latency_ms: number | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from("ai_usage").select("organization_id,module,model,purpose,pages,input_tokens,output_tokens,cost_usd,estimated,status,key_owner,at,latency_ms").gte("at", d30 < m0 ? d30 : m0).order("at").range(from, from + 999);
    rows.push(...((data ?? []) as typeof rows));
    if (!data || data.length < 1000) break;
  }
  const [{ data: budgets }, { data: prices }, { data: settings }, { data: orgs }, { data: subs }] = await Promise.all([
    db.from("ai_budgets").select("*").order("scope"), db.from("ai_prices").select("*").order("model"),
    db.from("ai_settings").select("ocr_enabled,billing_confirmed_at,billing_note,invoice_month,invoice_usd").single(),
    db.from("organizations").select("id,name"), db.from("saas_subscriptions").select("organization_id,plan_id,status"),
  ]);
  const name = new Map((orgs ?? []).map((o) => [o.id, o.name]));
  const month = rows.filter((r) => r.at >= m0 && r.status !== "falha");
  const sum = (xs: typeof rows, k: "cost_usd" | "pages" | "input_tokens" | "output_tokens") => xs.reduce((s, r) => s + Number(r[k] ?? 0), 0);
  const group = (xs: typeof rows, key: (r: (typeof rows)[number]) => string) => {
    const m = new Map<string, typeof rows>();
    for (const r of xs) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
    return [...m.entries()].map(([k, v]) => ({ key: k, calls: v.length, pages: sum(v, "pages"), inputTokens: sum(v, "input_tokens"), outputTokens: sum(v, "output_tokens"), costUsd: Math.round(sum(v, "cost_usd") * 1e6) / 1e6, platformCostUsd: Math.round(sum(v.filter((x) => x.key_owner === "plataforma"), "cost_usd") * 1e6) / 1e6 })).sort((a, b) => b.costUsd - a.costUsd);
  };
  const daily = group(rows.filter((r) => r.status !== "falha"), (r) => r.at.slice(0, 10)).sort((a, b) => a.key.localeCompare(b.key));
  const platformMonth = sum(month.filter((r) => r.key_owner === "plataforma"), "cost_usd");
  const day = now.getUTCDate(), daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const cap = Number((budgets ?? []).find((b) => b.scope === "plataforma")?.monthly_usd ?? 0);
  const alertPct = Number((budgets ?? []).find((b) => b.scope === "plataforma")?.alert_pct ?? 80);
  const projection = day ? (platformMonth / day) * daysInMonth : 0;
  const plan = new Map((subs ?? []).filter((s) => s.status === "ativa").map((s) => [s.organization_id, s.plan_id]));
  return NextResponse.json({
    ok: true,
    settings,
    month: { costUsd: Math.round(sum(month, "cost_usd") * 1e6) / 1e6, platformCostUsd: Math.round(platformMonth * 1e6) / 1e6, pages: sum(month, "pages"), inputTokens: sum(month, "input_tokens"), outputTokens: sum(month, "output_tokens"), calls: month.length, estimatedCalls: month.filter((r) => r.estimated).length, cacheHits: month.filter((r) => r.status === "cache").length, failures: rows.filter((r) => r.at >= m0 && r.status === "falha").length },
    projection: { usd: Math.round(projection * 100) / 100, cap, alertPct, alert: cap > 0 && (platformMonth >= cap * (alertPct / 100) || projection >= cap) },
    daily, byModule: group(month, (r) => r.module), byModel: group(month, (r) => r.model),
    byOffice: group(month, (r) => r.organization_id).map((g) => ({ ...g, name: name.get(g.key) ?? "—", plan: plan.get(g.key) ?? null })),
    budgets, prices,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return err(403, "Origem não permitida.");
  const me = await who(true);
  if (!me) return err(403, "Somente o Super Admin altera limites e configurações de IA.");
  const b = (await req.json().catch(() => ({}))) as { action?: string; scope?: string; ref?: string; monthlyUsd?: number | null; pagesDay?: number | null; pagesMonth?: number | null; alertPct?: number; enabled?: boolean; confirm?: boolean; note?: string; invoiceMonth?: string; invoiceUsd?: number };
  const db = supabaseAdmin();
  const audit = (detail: string) => db.from("audit_logs").insert({ organization_id: null, actor_id: me.id, action: `ia.${b.action}`, entity: "ai_settings", entity_id: b.scope ? `${b.scope}:${b.ref ?? ""}` : "ia", detail });
  const n = (v: unknown, max: number) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= max ? Number(v) : NaN);

  if (b.action === "budget") {
    const scope = String(b.scope);
    if (!["plataforma", "plano", "escritorio"].includes(scope)) return err(400, "Escopo inválido.");
    const ref = scope === "plataforma" ? "" : String(b.ref ?? "");
    if (scope === "plano" && !/^[a-z0-9-]{2,30}$/.test(ref)) return err(400, "Plano inválido.");
    if (scope === "escritorio" && !/^[0-9a-f-]{36}$/.test(ref)) return err(400, "Escritório inválido.");
    const monthly = n(b.monthlyUsd, 10_000), day = n(b.pagesDay, 100_000), month = n(b.pagesMonth, 1_000_000), alert = n(b.alertPct ?? 80, 100);
    if ([monthly, day, month, alert].some((x) => Number.isNaN(x))) return err(400, "Valores inválidos.");
    if (scope === "plataforma" && (monthly === null || monthly <= 0)) return err(400, "A plataforma precisa de um teto mensal em US$ (consumo irrestrito não é permitido).");
    await db.from("ai_budgets").upsert({ scope, ref, monthly_usd: scope === "plataforma" ? monthly : null, ocr_pages_day: day, ocr_pages_month: month, alert_pct: alert ?? 80, note: String(b.note ?? "").slice(0, 200), updated_by: me.id, updated_at: new Date().toISOString() }, { onConflict: "scope,ref" }).throwOnError();
    await audit(`limite: US$ ${monthly ?? "-"} / ${day ?? "-"} pág/dia / ${month ?? "-"} pág/mês`);
    return NextResponse.json({ ok: true });
  }
  if (b.action === "remove-budget") {
    if (b.scope === "plataforma") return err(400, "O teto da plataforma não pode ser removido.");
    await db.from("ai_budgets").delete().eq("scope", String(b.scope)).eq("ref", String(b.ref ?? ""));
    await audit("limite removido (volta ao do plano/plataforma)");
    return NextResponse.json({ ok: true });
  }
  if (b.action === "billing") {
    // Confirmação EXPRESSA: o Super Admin declara que o projeto Google da chave da plataforma tem faturamento ativo
    // (Paid Service: conteúdo não usado para treino). Sem isso, nenhum OCR é reservado no banco.
    if (b.confirm && String(b.note ?? "").trim().length < 10) return err(400, "Descreva a evidência (ex.: projeto, conta de faturamento, data) com pelo menos 10 caracteres.");
    await db.from("ai_settings").update({ billing_confirmed_at: b.confirm ? new Date().toISOString() : null, billing_confirmed_by: b.confirm ? me.id : null, billing_note: String(b.note ?? "").slice(0, 300), ...(b.confirm ? {} : { ocr_enabled: false }), updated_at: new Date().toISOString() }).eq("id", true).throwOnError();
    await audit(b.confirm ? "faturamento Google confirmado" : "confirmação de faturamento retirada (OCR desligado)");
    return NextResponse.json({ ok: true });
  }
  if (b.action === "ocr") {
    const { data: s } = await db.from("ai_settings").select("billing_confirmed_at").single();
    if (b.enabled && !s?.billing_confirmed_at) return err(409, "Confirme o faturamento do Google antes de ligar o OCR.");
    await db.from("ai_settings").update({ ocr_enabled: !!b.enabled, updated_at: new Date().toISOString() }).eq("id", true).throwOnError();
    await audit(b.enabled ? "OCR ligado" : "OCR desligado");
    return NextResponse.json({ ok: true });
  }
  if (b.action === "invoice") {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(b.invoiceMonth)) || !(Number(b.invoiceUsd) >= 0)) return err(400, "Informe mês (AAAA-MM) e valor da fatura.");
    await db.from("ai_settings").update({ invoice_month: b.invoiceMonth, invoice_usd: Number(b.invoiceUsd), updated_at: new Date().toISOString() }).eq("id", true).throwOnError();
    await audit(`custo apurado ${b.invoiceMonth}: US$ ${b.invoiceUsd}`);
    return NextResponse.json({ ok: true });
  }
  return err(400, "Ação desconhecida.");
}
