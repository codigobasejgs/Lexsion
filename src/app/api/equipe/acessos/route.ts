import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/env";
import { weakPassword } from "@/domain/passwords";

// Acesso de equipe criado pelo TITULAR/GESTOR com e-mail e senha definidos por ele. Nenhum e-mail é enviado: o
// endereço serve só como login (pode ser de domínio do escritório sem caixa de entrada). A conta nasce confirmada.
// Também: trocar a senha de um membro (só contas criadas assim) e remover o acesso. Autorização em 2 camadas:
// papel conferido com a sessão do pedinte; vínculo gravado com a sessão dele (RLS, memberships_guard e memberships_quota).
const ROLES = ["admin", "tenant_admin", "advogado", "controladoria", "financeiro", "atendimento", "estagiario", "external_collaborator"] as const;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const err = (status: number, code: string, message: string) => NextResponse.json({ ok: false, error: { code, message } }, { status });

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return err(503, "not_configured", "Backend não configurado neste ambiente.");
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return err(403, "origin", "Origem não permitida.");
  const b = (await req.json().catch(() => null)) as { organizationId?: string; action?: "create" | "password" | "remove"; email?: string; password?: string; fullName?: string; role?: string; userId?: string } | null;
  const org = String(b?.organizationId ?? "");
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return err(401, "unauthenticated", "Sessão expirada. Entre novamente.");
  const { data: me } = await sb.from("organization_memberships").select("role").eq("organization_id", org).eq("user_id", auth.user.id).maybeSingle();
  if (!me || !["admin", "tenant_admin"].includes(me.role)) return err(403, "forbidden", "Somente o titular ou o gestor cria acessos da equipe.");
  const admin = supabaseAdmin();
  const audit = (action: string, entityId: string, detail: string) => admin.from("audit_logs").insert({ organization_id: org, actor_id: auth.user!.id, action, entity: "organization_memberships", entity_id: entityId, detail });

  if (b?.action === "create") {
    const email = String(b.email ?? "").trim().toLowerCase();
    const fullName = String(b.fullName ?? "").trim().slice(0, 120);
    const role = b.role as (typeof ROLES)[number];
    const password = String(b.password ?? "");
    if (!EMAIL.test(email) || fullName.length < 3 || !ROLES.includes(role)) return err(400, "invalid", "Informe nome, e-mail de login válido e perfil.");
    if (weakPassword(password)) return err(400, "weak_password", "Senha fraca: use 10 ou mais caracteres, com letras e números.");
    if (role === "admin" && me.role !== "admin") return err(403, "forbidden", "Somente o titular concede o papel de titular.");
    // Limite do plano (mesma regra do banco, memberships_quota: cortesia vigente > assinatura) conferido ANTES de
    // criar a conta, para não deixar login solto; o banco confere de novo ao gravar o vínculo.
    const [{ data: ov }, { data: sub }, { count }] = await Promise.all([
      admin.from("saas_entitlement_overrides").select("value").eq("organization_id", org).eq("key", "max_users").is("revoked_at", null).or(`until.is.null,until.gt.${new Date().toISOString()}`),
      admin.from("saas_subscriptions").select("max_users").eq("organization_id", org).maybeSingle(),
      admin.from("organization_memberships").select("user_id", { count: "exact", head: true }).eq("organization_id", org),
    ]);
    const lim = ov?.length ? Math.max(...ov.map((v) => Number(v.value))) : sub?.max_users ?? null;
    if (lim != null && (count ?? 0) >= lim) return err(409, "plan_limit", `O plano permite ${lim} usuário(s) e a equipe já tem ${count}. Mude de plano ou remova alguém antes.`);
    const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName, created_by_office: org } });
    if (cErr) return err(/already|registered|exists/i.test(cErr.message) ? 409 : 502, "create_failed", /already|registered|exists/i.test(cErr.message) ? "Já existe uma conta com este e-mail. Use “Convidar membro” para vincular a conta existente, ou escolha outro e-mail de login." : "Não foi possível criar o acesso agora. Tente de novo.");
    const uid = created.user.id;
    const { error: mErr } = await sb.from("organization_memberships").insert({ organization_id: org, user_id: uid, role });
    if (mErr) {
      await admin.auth.admin.deleteUser(uid); // sem vínculo não fica conta solta
      return err(/limite de .* usuário/.test(mErr.message) ? 409 : 403, "membership", mErr.message.replace(/^.*?:\s*/, "") || "Vínculo recusado pelas regras de acesso.");
    }
    await admin.from("profiles").upsert({ user_id: uid, full_name: fullName }, { onConflict: "user_id" });
    await audit("equipe.acesso_criado", uid, `acesso com senha criado (${role}); nenhum e-mail enviado`);
    return NextResponse.json({ ok: true, data: { userId: uid } });
  }

  // Ações sobre um membro existente deste escritório.
  const uid = String(b?.userId ?? "");
  const { data: target } = await admin.from("organization_memberships").select("role").eq("organization_id", org).eq("user_id", uid).maybeSingle();
  if (!target) return err(404, "not_found", "Pessoa não encontrada nesta equipe.");
  if (uid === auth.user.id) return err(400, "self", "Use “Alterar senha” no seu perfil para a sua própria conta.");
  if (target.role === "admin" || (target.role === "tenant_admin" && me.role !== "admin")) return err(403, "forbidden", "Você não pode alterar o acesso desta pessoa.");

  if (b?.action === "password") {
    const password = String(b.password ?? "");
    if (weakPassword(password)) return err(400, "weak_password", "Senha fraca: use 10 ou mais caracteres, com letras e números.");
    // Só contas criadas por ESTE escritório: senha de quem tem conta própria (outros escritórios, portal) não é tocada.
    const { data: u } = await admin.auth.admin.getUserById(uid);
    if ((u.user?.user_metadata as { created_by_office?: string } | undefined)?.created_by_office !== org) return err(403, "not_owned", "Esta pessoa entrou por convite e tem senha própria. Ela pode redefinir em “Esqueci a senha”.");
    const { error } = await admin.auth.admin.updateUserById(uid, { password });
    if (error) return err(502, "update_failed", "Não foi possível trocar a senha agora.");
    await admin.auth.admin.signOut(uid, "global").catch(() => null); // sessões antigas caem
    await audit("equipe.senha_redefinida", uid, "senha redefinida pelo titular/gestor; sessões encerradas");
    return NextResponse.json({ ok: true });
  }
  if (b?.action === "remove") {
    const { error } = await sb.from("organization_memberships").delete().eq("organization_id", org).eq("user_id", uid);
    if (error) return err(403, "forbidden", "Remoção recusada pelas regras de acesso.");
    // Conta criada por este escritório e sem outro vínculo: apagada. Conta própria da pessoa: só perde o vínculo.
    const { data: u } = await admin.auth.admin.getUserById(uid);
    const { count } = await admin.from("organization_memberships").select("user_id", { count: "exact", head: true }).eq("user_id", uid);
    if ((u.user?.user_metadata as { created_by_office?: string } | undefined)?.created_by_office === org && !count) await admin.auth.admin.deleteUser(uid);
    else await admin.auth.admin.signOut(uid, "global").catch(() => null);
    await audit("equipe.acesso_removido", uid, "acesso removido da equipe");
    return NextResponse.json({ ok: true });
  }
  return err(400, "invalid", "Ação desconhecida.");
}
