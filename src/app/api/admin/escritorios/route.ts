import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/env";

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const PLANS = ["trial", "essencial", "profissional", "avancado", "enterprise"];
const err = (status: number, code: string, message: string) => NextResponse.json({ ok: false, error: { code, message } }, { status });

/**
 * Super Admin cria escritório REAL e convida o(a) titular.
 * 1) confere com a sessão do pedinte que ele é da plataforma; 2) convida/acha a conta do titular (chave secreta só aqui);
 * 3) cria o escritório pela função do banco (que reconfere a plataforma) já com o titular como "admin".
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return err(503, "not_configured", "Backend não configurado neste ambiente.");
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return err(403, "origin", "Origem não permitida.");
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const slug = String(b?.slug ?? "");
  const name = String(b?.name ?? "").trim();
  const ownerEmail = String(b?.ownerEmail ?? "").trim().toLowerCase();
  const ownerName = String(b?.ownerName ?? "").trim().slice(0, 120);
  const plan = String(b?.plan ?? "trial");
  if (!SLUG.test(slug) || name.length < 3 || name.length > 160 || !EMAIL.test(ownerEmail) || !ownerName || !PLANS.includes(plan)) return err(400, "invalid", "Dados do escritório inválidos.");

  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return err(401, "unauthenticated", "Sessão expirada. Entre novamente.");
  const { data: plat } = await sb.from("platform_members").select("role").eq("user_id", auth.user.id).maybeSingle();
  if (!plat || !["superadmin", "platform_admin"].includes(plat.role)) return err(403, "forbidden", "Somente a plataforma cria escritórios.");
  const { data: taken } = await sb.from("organizations").select("id").eq("slug", slug).maybeSingle();
  if (taken) return err(409, "slug_taken", "Endereço já em uso por outro escritório.");

  const admin = supabaseAdmin();
  const proto = req.headers.get("host")?.startsWith("localhost") ? "http" : "https";
  const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(ownerEmail, { data: { full_name: ownerName }, redirectTo: `${proto}://${req.headers.get("host")}/redefinir-senha` });
  let ownerId = inv?.user?.id;
  if (invErr) {
    if (!/already|registered|exists/i.test(invErr.message)) return err(502, "invite_failed", "Não foi possível enviar o convite ao titular agora.");
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    ownerId = list?.users.find((u) => u.email?.toLowerCase() === ownerEmail)?.id;
    if (!ownerId) return err(502, "invite_failed", "Não foi possível localizar a conta do titular.");
  }
  await admin.from("profiles").upsert({ user_id: ownerId, full_name: ownerName }, { onConflict: "user_id", ignoreDuplicates: true });

  // Criação pela sessão do pedinte: a função do banco confere de novo que é a plataforma.
  const { data: org, error } = await sb.rpc("create_organization", { p_slug: slug, p_name: name, p_owner: ownerId });
  if (error || !org) return err(error?.code === "23514" ? 400 : 403, "create_failed", error?.code === "23514" ? "Endereço reservado pela plataforma." : "Não foi possível criar o escritório.");
  const id = (org as { id: string }).id;
  const meta = { ownerName, ownerEmail, cycle: b?.cycle ?? "mensal", trialEndsAt: b?.trialEndsAt ?? null, document: String(b?.document ?? "").slice(0, 20) || null };
  await sb.rpc("platform_set_org_meta", { p_org: id, p_meta: meta });
  if (plan !== "trial") await sb.rpc("set_organization_plan", { p_org: id, p_plan: plan });
  if (b?.status === "ativa") await sb.rpc("set_organization_status", { p_org: id, p_status: "ativa", p_reason: null });
  if (b?.branding && typeof b.branding === "object") await sb.rpc("platform_set_org_branding", { p_org: id, p_branding: b.branding });
  return NextResponse.json({ ok: true, data: { id, invited: !invErr } });
}
