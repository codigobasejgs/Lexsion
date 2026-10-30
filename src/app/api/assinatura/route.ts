import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Titular do escritório: pede troca de plano (vale no próximo período) ou cancela ao fim do período pago.
// O preço NUNCA vem daqui: a próxima cobrança usa o valor do plano gravado no banco. Só o titular DESTE escritório.
const err = (status: number, message: string) => NextResponse.json({ ok: false, error: { message } }, { status });

export async function POST(req: NextRequest) {
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return err(403, "Origem não permitida.");
  const b = (await req.json().catch(() => ({}))) as { organizationId?: string; action?: string; plan?: string };
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return err(401, "Sessão expirada. Entre novamente.");
  // Confere com a sessão do pedinte (RLS): é titular (admin) deste escritório.
  const { data: isOwner } = await sb.rpc("is_org_owner", { org: b.organizationId });
  if (isOwner !== true) return err(403, "Somente o(a) titular do escritório altera a assinatura.");
  const db = supabaseAdmin();
  const { data: s } = await db.from("saas_subscriptions").select("organization_id,plan_id,current_period_end,status").eq("organization_id", b.organizationId!).maybeSingle();
  if (!s) return err(404, "Este escritório não tem assinatura contratada pelo site.");
  const audit = (action: string, detail: string) => db.from("audit_logs").insert({ organization_id: s.organization_id, actor_id: auth.user!.id, action, entity: "saas_subscriptions", entity_id: s.organization_id, detail });
  if (b.action === "change") {
    const { data: p } = await db.from("saas_plans").select("id,label,max_users,approved").eq("id", String(b.plan ?? "")).maybeSingle();
    if (!p?.approved) return err(400, "Plano indisponível.");
    if (p.id === s.plan_id) { await db.from("saas_subscriptions").update({ change_request: null, updated_at: new Date().toISOString() }).eq("organization_id", s.organization_id); return NextResponse.json({ ok: true }); }
    const { count } = await db.from("organization_memberships").select("user_id", { count: "exact", head: true }).eq("organization_id", s.organization_id);
    if ((count ?? 0) > p.max_users) return err(409, `O plano ${p.label} permite ${p.max_users} usuário(s); a equipe tem ${count}. Remova pessoas antes.`);
    await db.from("saas_subscriptions").update({ change_request: { plan: p.id, at: new Date().toISOString(), by: auth.user.id }, updated_at: new Date().toISOString() }).eq("organization_id", s.organization_id);
    await audit("assinatura.troca_pedida", `${s.plan_id} → ${p.id} a partir de ${s.current_period_end}`);
    return NextResponse.json({ ok: true });
  }
  if (b.action === "cancel" || b.action === "undo-cancel") {
    const cancel = b.action === "cancel";
    await db.from("saas_subscriptions").update({ cancel_at_period_end: cancel, updated_at: new Date().toISOString() }).eq("organization_id", s.organization_id);
    await audit(cancel ? "assinatura.cancelamento_pedido" : "assinatura.cancelamento_desfeito", `fim do período: ${s.current_period_end}`);
    return NextResponse.json({ ok: true });
  }
  return err(400, "Ação desconhecida.");
}
