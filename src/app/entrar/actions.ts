"use server";

import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";
import type { Result } from "@/services/contracts";

const cid = () => crypto.randomUUID().slice(0, 8);
const fail = (code: string, message: string): Result<never> => ({ ok: false, error: { code, message, retryable: code === "network" }, correlationId: cid() });
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

// Mensagem única para credencial errada, usuário inexistente ou não confirmado: não revela se a conta existe.
const GENERIC = "E-mail ou senha incorretos, ou acesso ainda não ativado pelo convite.";

/** Login real (Supabase Auth). Valida no servidor; sessão em cookie httpOnly gerido pelo @supabase/ssr. */
export async function signInAction(input: { email: string; password: string; audience: "escritorio" | "cliente" }): Promise<Result<{ redirectTo: string }>> {
  if (!supabaseConfigured()) return fail("auth_not_configured", "O acesso com e-mail e senha não está configurado neste ambiente.");
  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");
  if (!EMAIL.test(email) || password.length < 10 || password.length > 128) return fail("invalid", GENERIC);
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) return fail(error?.status && error.status >= 500 ? "network" : "invalid", error?.status && error.status >= 500 ? "Serviço de login indisponível. Tente de novo em instantes." : GENERIC);
  // Destino pelo vínculo REAL no banco (RLS: o usuário só lê os próprios vínculos).
  const [{ data: plat }, { data: memb }, { data: portal }] = await Promise.all([
    sb.from("platform_members").select("role").eq("user_id", data.user.id).maybeSingle(),
    sb.from("organization_memberships").select("organization_id").eq("user_id", data.user.id).limit(1),
    sb.from("client_portal_access").select("client_id").eq("user_id", data.user.id).limit(1),
  ]);
  const redirectTo = input.audience === "cliente" ? (portal?.length ? "/portal" : null) : plat ? "/admin" : memb?.length ? "/app/inicio" : portal?.length ? "/portal" : null;
  if (!redirectTo) {
    await sb.auth.signOut();
    return fail("no_access", "Sua conta ainda não está vinculada a um escritório. Peça ao responsável para concluir o convite.");
  }
  return { ok: true, data: { redirectTo }, correlationId: cid() };
}

export async function requestPasswordResetAction(input: { email: string }): Promise<Result<{ accepted: true }>> {
  if (!supabaseConfigured()) return fail("auth_not_configured", "A recuperação de acesso não está configurada neste ambiente.");
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return fail("invalid", "Informe um e-mail válido.");
  const host = (await headers()).get("host") ?? "lexsion.com.br";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const sb = await supabaseServer();
  // Resposta igual exista ou não a conta (anti-enumeração). Erro só se o serviço falhar.
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${proto}://${host}/redefinir-senha` });
  if (error && (error.status ?? 0) >= 500) return fail("network", "Não foi possível pedir a redefinição agora. Tente de novo em instantes.");
  return { ok: true, data: { accepted: true }, correlationId: cid() };
}

export async function signOutAction(): Promise<Result<true>> {
  if (!supabaseConfigured()) return { ok: true, data: true, correlationId: cid() };
  await (await supabaseServer()).auth.signOut();
  return { ok: true, data: true, correlationId: cid() };
}
