import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SOURCES, syncSource, type SourceId } from "@/lib/legal-intel/sync";
import { syncOfficial } from "@/lib/official-sources";

// Super Admin: executar sincronização agora (auditado). Só plataforma; só fontes habilitadas.
export const maxDuration = 300;
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return NextResponse.json({ ok: false }, { status: 403 });
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: { message: "Sessão expirada." } }, { status: 401 });
  // Mesma regra do banco: vínculo de plataforma vigente (is_platform).
  const { data: isPlat } = await sb.rpc("is_platform", { roles: ["superadmin", "platform_admin"] });
  const { data: modOk } = await sb.rpc("platform_module_ok", { p_module: "integracoes" }); // módulo liberado para a pessoa pelo Super Admin
  if (isPlat !== true || modOk !== true) return NextResponse.json({ ok: false, error: { message: "Somente a administração da plataforma." } }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { provider?: string; maxItems?: number };
  if (b.provider === "bcb-sgs" || b.provider === "stj-precedentes") {
    const r = await syncOfficial("manual");
    await supabaseAdmin().from("audit_logs").insert({ organization_id: null, actor_id: auth.user.id, action: "intel.sync", entity: "organizations", entity_id: "fontes-oficiais", detail: "execução manual" });
    return NextResponse.json({ ok: true, data: r[b.provider] });
  }
  if (!SOURCES.includes(b.provider as SourceId)) return NextResponse.json({ ok: false, error: { message: "Fonte não habilitada para execução." } }, { status: 400 });
  const r = await syncSource(b.provider as SourceId, "manual", { maxItems: Math.min(Math.max(Number(b.maxItems) || 150, 1), 300) });
  await supabaseAdmin().from("audit_logs").insert({ organization_id: null, actor_id: auth.user.id, action: "intel.sync", entity: "organizations", entity_id: b.provider, detail: `execução manual: ${r.status}` });
  return NextResponse.json({ ok: true, data: r });
}
