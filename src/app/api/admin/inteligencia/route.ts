import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SOURCES, syncSource, type SourceId } from "@/lib/legal-intel/sync";

// Super Admin: executar sincronização agora (auditado). Só plataforma; só fontes habilitadas.
export const maxDuration = 300;
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return NextResponse.json({ ok: false }, { status: 403 });
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: { message: "Sessão expirada." } }, { status: 401 });
  // Mesma regra do banco: vínculo de plataforma E sessão com 2º fator (aal2).
  const { data: isPlat } = await sb.rpc("is_platform", { roles: ["superadmin", "platform_admin"] });
  if (isPlat !== true) return NextResponse.json({ ok: false, error: { message: "Somente a plataforma, com verificação em duas etapas." } }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { provider?: string; maxItems?: number };
  if (!SOURCES.includes(b.provider as SourceId)) return NextResponse.json({ ok: false, error: { message: "Fonte não habilitada para execução." } }, { status: 400 });
  const r = await syncSource(b.provider as SourceId, "manual", { maxItems: Math.min(Math.max(Number(b.maxItems) || 150, 1), 300) });
  await supabaseAdmin().from("audit_logs").insert({ organization_id: null, actor_id: auth.user.id, action: "intel.sync", entity: "organizations", entity_id: b.provider, detail: `execução manual: ${r.status}` });
  return NextResponse.json({ ok: true, data: r });
}
