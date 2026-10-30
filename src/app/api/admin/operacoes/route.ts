import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Ações do Super Admin sobre escritórios. Cada ação chama UMA função SQL com a SESSÃO do administrador:
// o banco confere papel + MFA (aal2), trava a linha, checa a versão (concorrência), aplica e audita na mesma
// transação. Nada aqui usa a chave secreta para alterar dados, exceto o reenvio do convite (Auth Admin).
const err = (status: number, message: string) => NextResponse.json({ ok: false, error: { message } }, { status });
const friendly = (m: string) => m.replace(/^.*?: /, "");
type Body = { action?: string; org?: string; op?: string; days?: number; until?: string; reason?: string; expected?: string; key?: string; plan?: string; mode?: string; status?: string; value?: number | null; email?: string };

export async function POST(req: NextRequest) {
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return err(403, "Origem não permitida.");
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b.org || !/^[0-9a-f-]{36}$/.test(b.org)) return err(400, "Escritório inválido.");
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return err(401, "Sessão expirada. Entre novamente.");
  const reason = String(b.reason ?? "").trim().slice(0, 500);
  const expected = b.expected ?? null;
  const key = b.key && /^[\w-]{8,80}$/.test(b.key) ? b.key : null; // duplo clique: mesma chave ⇒ uma aplicação
  const call = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await sb.rpc(fn, args);
    if (error) return err(error.code === "42501" ? 403 : error.code === "40001" ? 409 : 400, friendly(error.message));
    return NextResponse.json({ ok: true, data });
  };
  switch (b.action) {
    case "trial":
      return call("platform_trial", { p_org: b.org, p_op: b.op, p_days: b.days ?? null, p_until: b.until ?? null, p_reason: reason, p_expected: expected, p_key: key });
    case "courtesy":
      return call("platform_courtesy", { p_org: b.org, p_op: b.op, p_until: b.until ?? null, p_reason: reason, p_expected: expected, p_key: key });
    case "plan":
      return call("platform_set_plan", { p_org: b.org, p_plan: b.plan, p_mode: b.mode === "proxima_renovacao" ? "proxima_renovacao" : "imediato", p_reason: reason, p_expected: expected });
    case "status":
      return call("platform_set_status", { p_org: b.org, p_status: b.status, p_reason: reason, p_expected: expected });
    case "limit":
      return call("platform_override", { p_org: b.org, p_value: b.value ?? null, p_until: b.until ?? null, p_reason: reason });
    case "invite": {
      // Reenvio do convite do titular: confere a plataforma (sessão + MFA) ANTES de usar o Auth Admin.
      const { data: ok } = await sb.rpc("is_platform", { roles: ["superadmin", "platform_admin", "platform_support"] });
      if (ok !== true) return err(403, "Somente a plataforma, com verificação em duas etapas.");
      if (reason.length < 5) return err(400, "Informe o motivo (mínimo 5 caracteres).");
      const db = supabaseAdmin();
      const { data: m } = await db.from("organization_memberships").select("user_id").eq("organization_id", b.org).eq("role", "admin").order("created_at").limit(1).maybeSingle();
      if (!m) return err(404, "Escritório sem titular.");
      const { data: u } = await db.auth.admin.getUserById(m.user_id);
      if (!u.user?.email) return err(404, "Titular sem e-mail.");
      const site = `${req.headers.get("host")?.startsWith("localhost") ? "http" : "https"}://${req.headers.get("host")}`;
      // Já entrou alguma vez: manda link de redefinição; nunca entrou: reenvia o convite.
      const r = u.user.last_sign_in_at
        ? await db.auth.resetPasswordForEmail(u.user.email, { redirectTo: `${site}/redefinir-senha` })
        : await db.auth.admin.inviteUserByEmail(u.user.email, { redirectTo: `${site}/redefinir-senha` });
      const sent = !r.error || /already|registered/i.test(r.error.message);
      const fallback = !sent ? null : r.error ? await db.auth.resetPasswordForEmail(u.user.email, { redirectTo: `${site}/redefinir-senha` }) : null;
      const delivered = sent && (!fallback || !fallback.error);
      await db.from("audit_logs").insert({ organization_id: b.org, actor_id: auth.user.id, action: "convite.reenviado", entity: "organizations", entity_id: b.org, reason, detail: delivered ? "e-mail de acesso aceito pelo provedor de autenticação" : "envio falhou" });
      return delivered ? NextResponse.json({ ok: true, data: { sentTo: u.user.email.replace(/^(.).*(@.*)$/, "$1***$2") } }) : err(502, "Não foi possível enviar o e-mail agora. Nada foi alterado.");
    }
    default:
      return err(400, "Ação desconhecida.");
  }
}
