import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/env";

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const err = (status: number, code: string, message: string) => NextResponse.json({ ok: false, error: { code, message } }, { status });

/**
 * Dá acesso ao portal a um cliente do escritório. Autorização no banco: o vínculo é gravado com a sessão do PEDINTE
 * (RLS de portal_links exige advogado(a)/gestor/titular e que o cliente exista no escritório). A chave secreta só envia o convite.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return err(503, "not_configured", "Backend não configurado neste ambiente.");
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return err(403, "origin", "Origem não permitida.");
  const b = (await req.json().catch(() => null)) as { organizationId?: string; clientId?: string; email?: string; fullName?: string } | null;
  const email = String(b?.email ?? "").trim().toLowerCase();
  if (!b?.organizationId || !b.clientId || !EMAIL.test(email)) return err(400, "invalid", "Informe um e-mail válido.");

  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return err(401, "unauthenticated", "Sessão expirada. Entre novamente.");
  const { data: me } = await sb.from("organization_memberships").select("role").eq("organization_id", b.organizationId).eq("user_id", auth.user.id).maybeSingle();
  if (!me || !["admin", "tenant_admin", "advogado"].includes(me.role)) return err(403, "forbidden", "Somente advogado(a), gestor ou titular libera o portal.");
  const { data: client } = await sb.from("org_records").select("id").eq("organization_id", b.organizationId).eq("collection", "clients").eq("id", b.clientId).maybeSingle();
  if (!client) return err(404, "not_found", "Cliente não encontrado neste escritório.");

  const admin = supabaseAdmin();
  const proto = req.headers.get("host")?.startsWith("localhost") ? "http" : "https";
  const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: String(b.fullName ?? "").slice(0, 120) }, redirectTo: `${proto}://${req.headers.get("host")}/redefinir-senha` });
  let userId = inv?.user?.id;
  if (invErr) {
    if (!/already|registered|exists/i.test(invErr.message)) return err(502, "invite_failed", "Não foi possível enviar o convite agora.");
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (!userId) return err(502, "invite_failed", "Não foi possível localizar a conta.");
  }
  const { error } = await sb.from("portal_links").upsert({ user_id: userId, organization_id: b.organizationId, client_id: b.clientId }, { onConflict: "user_id,organization_id,client_id", ignoreDuplicates: true });
  if (error) return err(403, "forbidden", "Vínculo recusado pelas regras de acesso.");
  await admin.from("profiles").upsert({ user_id: userId, full_name: String(b.fullName ?? "").slice(0, 120) }, { onConflict: "user_id", ignoreDuplicates: true });
  return NextResponse.json({ ok: true, data: { invited: !invErr } });
}
