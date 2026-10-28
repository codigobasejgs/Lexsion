import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncCamara } from "@/lib/legal-intel/sync";

// Super Admin: executar sincronização agora (auditado). Só plataforma; só fontes habilitadas.
export const maxDuration = 300;
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return NextResponse.json({ ok: false }, { status: 403 });
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: { message: "Sessão expirada." } }, { status: 401 });
  const { data: plat } = await sb.from("platform_members").select("role").eq("user_id", auth.user.id).maybeSingle();
  if (!plat || !["superadmin", "platform_admin"].includes(plat.role)) return NextResponse.json({ ok: false, error: { message: "Somente a plataforma." } }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { provider?: string; maxItems?: number };
  if (b.provider !== "camara-proposicoes") return NextResponse.json({ ok: false, error: { message: "Fonte não habilitada para execução." } }, { status: 400 });
  const r = await syncCamara("manual", { maxItems: Math.min(Math.max(Number(b.maxItems) || 150, 1), 300) });
  await supabaseAdmin().from("audit_logs").insert({ organization_id: null, actor_id: auth.user.id, action: "intel.sync", entity: "organizations", entity_id: b.provider, detail: `execução manual: ${r.status}` });
  return NextResponse.json({ ok: true, data: r });
}
