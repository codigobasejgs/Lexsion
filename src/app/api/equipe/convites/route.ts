import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/env";

const ROLES = ["admin", "tenant_admin", "advogado", "controladoria", "financeiro", "atendimento", "estagiario", "external_collaborator"] as const;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const err = (status: number, code: string, message: string) => NextResponse.json({ ok: false, error: { code, message } }, { status });

/**
 * Convida pessoa para a equipe de um escritório. Autorização em 2 camadas:
 * 1) o servidor confere, com a sessão do PEDINTE (RLS), que ele é titular/gestor do escritório;
 * 2) só então usa a chave secreta para o convite do Auth e grava o vínculo.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return err(503, "not_configured", "Backend não configurado neste ambiente.");
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return err(403, "origin", "Origem não permitida.");
  const body = (await req.json().catch(() => null)) as { organizationId?: string; email?: string; role?: string; fullName?: string } | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  const role = body?.role as (typeof ROLES)[number];
  if (!body?.organizationId || !EMAIL.test(email) || !ROLES.includes(role)) return err(400, "invalid", "Dados do convite inválidos.");

  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return err(401, "unauthenticated", "Sessão expirada. Entre novamente.");
  const { data: me } = await sb.from("organization_memberships").select("role").eq("organization_id", body.organizationId).eq("user_id", auth.user.id).maybeSingle();
  if (!me || !["admin", "tenant_admin"].includes(me.role)) return err(403, "forbidden", "Somente o titular ou o gestor convida pessoas.");
  if (role === "admin" && me.role !== "admin") return err(403, "forbidden", "Somente o titular concede o papel de titular.");

  const admin = supabaseAdmin();
  const proto = req.headers.get("host")?.startsWith("localhost") ? "http" : "https";
  const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: String(body.fullName ?? "").slice(0, 120) }, redirectTo: `${proto}://${req.headers.get("host")}/redefinir-senha` });
  let userId = invited?.user?.id;
  if (invErr) {
    // Já tem conta: vincula sem novo convite (a pessoa entra com a senha que já tem).
    if (!/already|registered|exists/i.test(invErr.message)) return err(502, "invite_failed", "Não foi possível enviar o convite agora.");
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (!userId) return err(502, "invite_failed", "Não foi possível localizar a conta convidada.");
  }
  // O vínculo é gravado com a sessão do pedinte: a RLS reconfere que ele administra este escritório.
  const { error: mErr } = await sb.from("organization_memberships").upsert({ organization_id: body.organizationId, user_id: userId, role }, { onConflict: "organization_id,user_id" });
  if (mErr) return err(403, "forbidden", "Vínculo recusado pelas regras de acesso.");
  await admin.from("profiles").upsert({ user_id: userId, full_name: String(body.fullName ?? "").slice(0, 120) }, { onConflict: "user_id", ignoreDuplicates: true });
  return NextResponse.json({ ok: true, data: { userId, invited: !invErr } });
}
