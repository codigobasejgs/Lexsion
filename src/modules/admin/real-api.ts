"use client";

import { supabaseBrowser } from "@/lib/supabase/browser";

// Super Admin REAL: leituras pelas funções da plataforma (RLS + MFA no banco) e ações pela rota /api/admin/operacoes.
// Nunca usa fixtures da demonstração.
export type OrgRow = {
  id: string; slug: string; name: string; status: string; status_reason: string | null; plan: string; created_at: string; updated_at: string;
  trial_ends_at: string | null; courtesy_until: string | null; origem: string | null; owner_name: string | null; owner_email: string | null;
  owner_last_sign_in: string | null; owner_confirmed: boolean; members: number; max_users: number | null; clients: number; storage_bytes: number;
  last_activity: string | null; sub_status: string | null; sub_cycle: string | null; sub_price: number | null; period_end: string | null;
  cancel_at_period_end: boolean | null; last_paid_at: string | null; open_order: boolean; has_pwa_icon: boolean;
};
export type Metrics = {
  generated_at: string; days: number; orgs_total: number; by_status: Record<string, number>; trial_ending_7d: number; trial_expired: number; courtesy: number;
  new_orgs: number; invites_pending: number; by_plan: Record<string, number>; mrr: number | null; paying: number; paid_in_period: number | null; paid_count: number;
  pending_amount: number | null; refunded_in_period: number | null; paid_without_activation: number; canceled_in_period: number; trials_ever: number; trials_converted: number;
  funnel: Record<string, number>; support_open: number;
};
export type Timeline = {
  events: { at: string; action: string; detail: string | null; reason: string | null; before: unknown; after: unknown; actor_role: string | null; actor: string | null }[];
  grants: { kind: string; old_end: string | null; new_end: string | null; days: number | null; reason: string; created_at: string }[];
  overrides: { key: string; value: number; until: string | null; reason: string; revoked_at: string | null; created_at: string }[];
  team: { role: string; name: string; email: string | null; last_sign_in: string | null; confirmed: boolean }[];
  orders: { order_nsu: string; kind: string; amount: number; status: string; paid_at: string | null; created_at: string; activation: string }[];
  contracts: { number: string; status: string; accepted_at: string | null }[];
};

const rpc = async <T,>(fn: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabaseBrowser().rpc(fn, args);
  if (error) throw new Error(error.message.replace(/^.*?: /, ""));
  return data as T;
};
export const loadOrgs = () => rpc<OrgRow[]>("platform_orgs");
export const loadMetrics = (days: number) => rpc<Metrics>("platform_metrics", { p_days: days });
export const loadTimeline = (org: string) => rpc<Timeline>("platform_org_timeline", { p_org: org });
export const myPlatformRole = () => rpc<string | null>("platform_role");

export async function act(body: Record<string, unknown>): Promise<{ ok: boolean; message?: string; data?: Record<string, unknown> }> {
  const r = await fetch("/api/admin/operacoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (!r) return { ok: false, message: "Sem conexão. Nada foi alterado." };
  const j = await r.json().catch(() => null);
  return j?.ok ? { ok: true, data: j.data } : { ok: false, message: j?.error?.message ?? `Erro ${r.status}. Nada foi alterado.` };
}

/** Situação detalhada para exibição (derivada só de dados reais). */
export function lifecycle(o: OrgRow, now = Date.now()): { key: string; label: string; tone: "success" | "info" | "warning" | "danger" | "neutral" } {
  const left = o.trial_ends_at ? Math.ceil((Date.parse(o.trial_ends_at) - now) / 86_400_000) : null;
  if (o.status === "cancelada") return { key: "cancelado", label: "Cancelado", tone: "neutral" };
  if (o.status === "suspensa") return { key: "suspenso", label: "Suspenso", tone: "warning" };
  if (o.status === "inadimplente" || o.sub_status === "vencida") return { key: "atraso", label: "Em atraso", tone: "danger" };
  if (o.courtesy_until && Date.parse(o.courtesy_until) > now) return { key: "cortesia", label: "Cortesia", tone: "info" };
  if (o.status === "trial") return left !== null && left < 0 ? { key: "teste_expirado", label: "Teste expirado", tone: "danger" } : { key: "teste", label: left !== null ? `Teste · ${left} d` : "Teste", tone: left !== null && left <= 3 ? "warning" : "info" };
  if (o.sub_status === "ativa" && o.last_paid_at) return { key: "pagante", label: "Pagante", tone: "success" };
  return { key: "ativo", label: "Ativo (sem cobrança pelo site)", tone: "success" };
}
export const daysLeft = (iso: string | null, now = Date.now()) => (iso ? Math.ceil((Date.parse(iso) - now) / 86_400_000) : null);
export const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
export const fmtDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");
