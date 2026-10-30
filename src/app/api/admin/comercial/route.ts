import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { activate, confirmOrder } from "@/lib/billing";

// Super Admin (plataforma + MFA): edita planos sem código, reprocessa ativação, reconcilia pedido no /payment_check
// e registra estorno conferido na conta InfinitePay. Toda ação vai para a auditoria com o autor.
const err = (status: number, message: string) => NextResponse.json({ ok: false, error: { message } }, { status });

export async function POST(req: NextRequest) {
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return err(403, "Origem não permitida.");
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return err(401, "Sessão expirada.");
  const { data: isPlat } = await sb.rpc("is_platform", { roles: ["superadmin", "platform_admin"] });
  if (isPlat !== true) return err(403, "Somente a plataforma, com verificação em duas etapas.");
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = supabaseAdmin();
  const audit = (action: string, entity_id: string, detail: string, org: string | null = null) =>
    db.from("audit_logs").insert({ organization_id: org, actor_id: auth.user!.id, action, entity: "comercial", entity_id, detail: detail.slice(0, 500) });

  if (b.action === "plan.save") {
    const p = b.plan as Record<string, unknown>;
    const id = String(p?.id ?? "");
    const int = (v: unknown) => (v === null || v === "" ? null : Number.isInteger(Number(v)) ? Number(v) : NaN);
    const row = {
      label: String(p.label ?? "").trim().slice(0, 60), description: String(p.description ?? "").trim().slice(0, 160),
      price_monthly: int(p.price_monthly), price_yearly: int(p.price_yearly), max_users: int(p.max_users), trial_days: int(p.trial_days) ?? 0,
      visible: p.visible === true, approved: p.approved === true,
      features: Array.isArray(p.features) ? (p.features as { label: string; ok: boolean }[]).slice(0, 30).map((f) => ({ label: String(f.label).slice(0, 80), ok: f.ok === true })) : [],
    };
    if (!/^[a-z0-9-]{2,30}$/.test(id) || row.label.length < 2 || !(row.price_monthly! >= 100) || (row.price_yearly !== null && !(row.price_yearly >= 100)) || !(row.max_users! >= 1) || !(row.trial_days >= 0 && row.trial_days <= 30))
      return err(400, "Dados do plano inválidos (preço mínimo R$ 1,00; usuários ≥ 1; teste de 0 a 30 dias).");
    const { data: cur } = await db.from("saas_plans").select("*").eq("id", id).maybeSingle();
    // Mudou preço/limite: nova versão. Assinaturas existentes guardam a versão contratada (plan_snapshot) e não mudam.
    const changed = cur && (cur.price_monthly !== row.price_monthly || cur.price_yearly !== row.price_yearly || cur.max_users !== row.max_users);
    const { error } = await db.from("saas_plans").upsert({ id, ...row, version: (cur?.version ?? 0) + (changed || !cur ? 1 : 0), sort: cur?.sort ?? 99, updated_at: new Date().toISOString(), updated_by: auth.user.id });
    if (error) return err(400, "Plano recusado pelo banco.");
    await audit("plano.alterado", id, `${cur ? "antes " + JSON.stringify({ m: cur.price_monthly, a: cur.price_yearly, u: cur.max_users, ok: cur.approved, v: cur.visible }) + " → " : "novo "}${JSON.stringify({ m: row.price_monthly, a: row.price_yearly, u: row.max_users, ok: row.approved, v: row.visible })}`);
    return NextResponse.json({ ok: true });
  }
  const orderNsu = String(b.order ?? "");
  const { data: o } = await db.from("saas_orders").select("id,order_nsu,organization_id,status,transaction_nsu,invoice_slug,history").eq("order_nsu", orderNsu).maybeSingle();
  if (!o) return err(404, "Pedido não encontrado.");
  if (b.action === "order.reactivate") {
    const r = await activate(o.order_nsu);
    await audit("pedido.reprocessado", o.order_nsu, `ativação: ${r}`, o.organization_id);
    return NextResponse.json({ ok: r === "concluida", data: { activation: r } });
  }
  if (b.action === "order.check") {
    const tx = String(b.transaction_nsu ?? o.transaction_nsu ?? ""), slug = String(b.slug ?? o.invoice_slug ?? "");
    if (!tx || !slug) return err(400, "Informe o transaction_nsu e o slug da fatura (estão no painel InfinitePay, em Suas vendas).");
    try {
      const r = await confirmOrder(o.order_nsu, tx, slug, "super admin");
      await audit("pedido.conferido", o.order_nsu, r.ok ? "confirmado no payment_check" : `não confirmado: ${r.reason}`, o.organization_id);
      return NextResponse.json({ ok: r.ok, data: r });
    } catch { return err(502, "InfinitePay indisponível agora. Nada foi alterado."); }
  }
  if (b.action === "order.refund") {
    const reason = String(b.reason ?? "").trim();
    if (reason.length < 5) return err(400, "Informe o motivo (mínimo 5 caracteres).");
    if (o.status !== "pago") return err(409, "Só pedido pago pode ser marcado como estornado.");
    await db.from("saas_orders").update({ status: "estornado", history: [...((o.history as unknown[]) ?? []), { at: new Date().toISOString(), text: `Estorno conferido na InfinitePay: ${reason}` }], updated_at: new Date().toISOString() }).eq("id", o.id);
    if (o.organization_id) {
      await db.from("saas_subscriptions").update({ status: "suspensa", updated_at: new Date().toISOString() }).eq("organization_id", o.organization_id);
      await db.from("organizations").update({ status: "suspensa", status_reason: `Pagamento estornado: ${reason}`, updated_at: new Date().toISOString() }).eq("id", o.organization_id);
    }
    await audit("pedido.estornado", o.order_nsu, reason, o.organization_id);
    return NextResponse.json({ ok: true });
  }
  return err(400, "Ação desconhecida.");
}
