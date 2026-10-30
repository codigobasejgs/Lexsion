import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createCheckout } from "@/lib/infinitepay";
import { SITE } from "@/lib/billing";
import { checkoutEnabled, CONTRACT_VERSION } from "@/lib/saas-catalog";
import { isValidCnpj, isValidCpf } from "@/domain/crm";

// Cadastro público → pedido → link InfinitePay. O navegador manda SÓ escolha do plano e dados cadastrais:
// o valor vem do banco. Nenhuma conta é criada aqui; o escritório só nasce depois do pagamento conferido.
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVED = new Set(["admin", "app", "api", "www", "portal", "demo", "lexsion", "suporte", "status", "entrar"]);
const err = (status: number, code: string, message: string, field?: string) => NextResponse.json({ ok: false, error: { code, message, field } }, { status });

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return err(503, "not_configured", "Contratação indisponível neste ambiente.");
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return err(403, "origin", "Origem não permitida.");
  if (!checkoutEnabled()) return err(503, "disabled", "A contratação online ainda não foi liberada. Fale com a LexSion pelo contato.");
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const s = (k: string, max = 160) => String(b?.[k] ?? "").trim().slice(0, max);
  const c = { name: s("name", 120), email: s("email", 200).toLowerCase(), office: s("office"), slug: s("slug", 40).toLowerCase(), document: s("document", 20).replace(/\D/g, ""), phone: s("phone", 20).replace(/\D/g, "") };
  const plan = s("plan", 30), cycle = s("cycle", 10);
  if (c.name.length < 3) return err(400, "invalid", "Informe o nome completo do(a) titular.", "name");
  if (!EMAIL.test(c.email)) return err(400, "invalid", "Informe um e-mail válido.", "email");
  if (c.office.length < 3) return err(400, "invalid", "Informe o nome do escritório.", "office");
  if (!SLUG.test(c.slug) || RESERVED.has(c.slug)) return err(400, "invalid", "Endereço inválido ou reservado: 3 a 40 letras minúsculas, números ou hífen.", "slug");
  if (!(c.document.length === 11 ? isValidCpf(c.document) : c.document.length === 14 && isValidCnpj(c.document))) return err(400, "invalid", "Informe um CPF ou CNPJ válido.", "document");
  if (c.phone && !/^\d{10,13}$/.test(c.phone)) return err(400, "invalid", "Telefone inválido.", "phone");
  if (b?.accept !== true || b?.contractVersion !== CONTRACT_VERSION) return err(400, "contract", "É preciso aceitar os termos de contratação vigentes.", "accept");
  if (cycle !== "mensal" && cycle !== "anual") return err(400, "invalid", "Ciclo inválido.", "cycle");

  const db = supabaseAdmin();
  const { data: p } = await db.from("saas_plans").select("*").eq("id", plan).eq("visible", true).maybeSingle();
  if (!p || !p.approved) return err(409, "plan_unavailable", "Este plano ainda não está disponível para contratação.");
  const amount = cycle === "anual" ? p.price_yearly : p.price_monthly;
  if (!amount) return err(409, "plan_unavailable", "Ciclo não oferecido para este plano.", "cycle");
  if ((await db.from("organizations").select("id").eq("slug", c.slug).maybeSingle()).data) return err(409, "slug_taken", "Este endereço já está em uso. Escolha outro.", "slug");

  // Cadastro repetido (mesmo endereço pendente): devolve o MESMO pedido e link, sem duplicar.
  const { data: pending } = await db.from("saas_orders").select("order_nsu,checkout_url,customer,expires_at").eq("status", "pendente").eq("kind", "contratacao").eq("customer->>slug", c.slug).maybeSingle();
  if (pending) {
    if ((pending.customer as { email: string }).email === c.email && pending.checkout_url && new Date(pending.expires_at ?? 0) > new Date()) return NextResponse.json({ ok: true, data: { order: pending.order_nsu, url: pending.checkout_url, reused: true } });
    return err(409, "slug_pending", "Já existe um cadastro em andamento para este endereço. Use outro ou aguarde 24 horas.", "slug");
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
  const fp = crypto.createHash("sha256").update(`${ip}|${process.env.CRON_SECRET ?? ""}`).digest("hex").slice(0, 32);
  const { count } = await db.from("saas_orders").select("id", { count: "exact", head: true }).eq("request_fingerprint", fp).gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
  if ((count ?? 0) >= 5) return err(429, "rate", "Muitas tentativas. Tente novamente em uma hora.");

  const expires = new Date(Date.now() + 24 * 3_600_000).toISOString();
  const snapshot = { id: p.id, label: p.label, version: p.version, price_monthly: p.price_monthly, price_yearly: p.price_yearly, max_users: p.max_users, features: p.features };
  const { data: o, error } = await db.from("saas_orders").insert({
    plan_id: p.id, cycle, amount, plan_snapshot: snapshot, customer: c, contract_version: CONTRACT_VERSION, contract_accepted_at: new Date().toISOString(),
    request_fingerprint: fp, expires_at: expires, history: [{ at: new Date().toISOString(), text: `Pedido criado: ${p.label} ${cycle}, contrato ${CONTRACT_VERSION} aceito` }],
  }).select("id,order_nsu").single();
  if (error || !o) return err(error?.code === "23505" ? 409 : 500, "order_failed", error?.code === "23505" ? "Já existe um cadastro em andamento para este endereço." : "Não foi possível registrar o pedido agora.");
  try {
    const url = await createCheckout({
      orderNsu: o.order_nsu, items: [{ quantity: 1, price: amount, description: `LexSion ${p.label} — ${cycle === "anual" ? "12 meses" : "1 mês"}` }],
      redirectUrl: `${SITE}/contratar/retorno`, webhookUrl: `${SITE}/api/infinitepay/webhook`,
      customer: { name: c.name, email: c.email, ...(c.phone ? { phone_number: `+${c.phone.startsWith("55") ? c.phone : `55${c.phone}`}` } : {}) }, validUntil: expires,
    });
    await db.from("saas_orders").update({ checkout_url: url }).eq("id", o.id); // guardada antes de qualquer outra coisa (a API não reconsulta link)
    return NextResponse.json({ ok: true, data: { order: o.order_nsu, url } });
  } catch {
    await db.from("saas_orders").update({ status: "cancelado", history: [{ at: new Date().toISOString(), text: "Falha ao criar o link na InfinitePay; nada foi cobrado" }] }).eq("id", o.id);
    return err(502, "checkout_failed", "Não foi possível abrir o pagamento agora. Nada foi cobrado; tente de novo em instantes.");
  }
}
