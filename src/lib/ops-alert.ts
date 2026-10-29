import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Alerta operacional por e-mail ao(s) Super Admin(s) via Resend (gratuito até 3.000/mês). Só em FALHA, no máximo
// 1 por assunto a cada 12 h (deduplicado pela auditoria), sem dado de cliente no texto. Falha do alerta nunca derruba a rotina.
export async function opsAlert(subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const db = supabaseAdmin();
  const { count } = await db.from("audit_logs").select("id", { count: "exact", head: true }).eq("action", "ops.alerta").eq("entity_id", subject.slice(0, 120)).gte("at", new Date(Date.now() - 12 * 3_600_000).toISOString());
  if (count) return false;
  const { data: plat } = await db.from("platform_members").select("user_id").eq("role", "superadmin");
  const to: string[] = [];
  for (const p of plat ?? []) { const { data } = await db.auth.admin.getUserById(p.user_id); if (data.user?.email) to.push(data.user.email); }
  if (!to.length) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({ from: "LexSion Operação <nao-responda@lexsion.com.br>", to, subject: `[LexSion] ${subject}`, text: `${text}\n\nPainel: https://lexsion.com.br/admin/integracoes\n(Mensagem automática; não responda.)` }),
  }).catch(() => null);
  await db.from("audit_logs").insert({ organization_id: null, actor_id: null, action: "ops.alerta", entity: "operacao", entity_id: subject.slice(0, 120), detail: r?.ok ? "e-mail aceito pelo Resend" : `envio falhou (HTTP ${r?.status ?? "rede"})` });
  return !!r?.ok;
}
