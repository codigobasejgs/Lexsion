import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/env";

import type { PublicPlan } from "@/domain/saas";
export { CONTRACT_VERSION } from "@/domain/saas";

// Catálogo público de planos: lido do banco (Super Admin edita sem código). Venda só de plano APROVADO pelo dono.

export async function publicPlans(): Promise<PublicPlan[]> {
  if (!supabaseConfigured() || !process.env.SUPABASE_SECRET_KEY) return [];
  const { data } = await supabaseAdmin().from("saas_plans").select("id,label,description,price_monthly,price_yearly,max_users,trial_days,features,approved,version").eq("visible", true).order("sort");
  return (data ?? []) as PublicPlan[];
}
/** Contratação pública ligada? Exige plano aprovado E chave liberada pelo dono (SAAS_CHECKOUT_ENABLED=1). */
export const checkoutEnabled = () => process.env.SAAS_CHECKOUT_ENABLED === "1";
