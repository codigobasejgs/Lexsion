import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { activate, SITE } from "@/lib/billing";
import { createCheckout } from "@/lib/infinitepay";
import { opsAlert } from "@/lib/ops-alert";

// Rotina diária (Supabase Cron → pg_net, CRON_SECRET). A InfinitePay NÃO tem recorrência pela API: cada período
// vira um link avulso emitido aqui, avisado ao titular por e-mail. Regras (comunicadas nos termos):
//  * D-7: emite a cobrança do próximo período e envia o link; * vencimento + 5 dias sem pagamento: suspende
//    (dados preservados; pagar reativa na hora); * pedidos de contratação não pagos expiram em 24 h;
//  * pagamento confirmado sem ativação: nova tentativa todo dia.
export const maxDuration = 300;
const GRACE_DAYS = 5, NOTICE_DAYS = 7;
const day = (d: Date) => d.toISOString().slice(0, 10);

async function mail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const r = await fetch("https://api.resend.com/emails", { method: "POST", signal: AbortSignal.timeout(20_000), headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "LexSion Cobrança <nao-responda@lexsion.com.br>", to: [to], subject, text: `${text}\n\n(Mensagem automática; não responda.)` }) }).catch(() => null);
  return !!r?.ok;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 24 || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse(null, { status: 401 });
  const db = supabaseAdmin();
  const now = new Date(), today = day(now);
  const out = { expirados: 0, reativacoes: 0, cobrancas: 0, suspensos: 0, vencidos: 0, erros: [] as string[] };

  // 1) Pedidos de contratação não pagos: expiram (o link também expira, se houver API Key).
  const { data: exp } = await db.from("saas_orders").update({ status: "expirado", updated_at: now.toISOString() }).eq("status", "pendente").eq("kind", "contratacao").lt("expires_at", now.toISOString()).select("id");
  out.expirados = exp?.length ?? 0;
  // 2) Pago sem ativação: tenta de novo (nunca cobra de novo).
  for (const o of (await db.from("saas_orders").select("order_nsu").in("status", ["pago", "teste"]).neq("activation", "concluida").limit(20)).data ?? []) {
    if ((await activate(o.order_nsu)) === "concluida") out.reativacoes++;
  }
  // 3) Renovação: período terminando em até 7 dias sem cobrança emitida.
  const { data: subs } = await db.from("saas_subscriptions").select("organization_id,plan_id,cycle,price,current_period_end,status,cancel_at_period_end,plan_snapshot,change_request").in("status", ["teste", "ativa", "vencida", "suspensa"]);
  const { data: catalog } = await db.from("saas_plans").select("*");
  for (const s of subs ?? []) {
    const end = new Date(`${s.current_period_end}T12:00:00-03:00`);
    const daysLeft = Math.round((end.getTime() - now.getTime()) / 86_400_000);
    const { data: org } = await db.from("organizations").select("name,status,status_reason,meta").eq("id", s.organization_id).single();
    const owner = (org?.meta as { ownerEmail?: string } | null)?.ownerEmail;
    if (s.cancel_at_period_end) {
      if (daysLeft < 0 && s.status !== "cancelada") {
        await db.from("saas_subscriptions").update({ status: "cancelada", updated_at: now.toISOString() }).eq("organization_id", s.organization_id);
        await db.from("organizations").update({ status: "cancelada", status_reason: "Cancelado pelo titular ao fim do período", updated_at: now.toISOString() }).eq("id", s.organization_id);
        await db.from("audit_logs").insert({ organization_id: s.organization_id, actor_id: null, action: "assinatura.cancelada", entity: "saas_subscriptions", entity_id: s.organization_id, detail: "fim do período; dados preservados" });
      }
      continue;
    }
    if (daysLeft <= NOTICE_DAYS) {
      const { data: open } = await db.from("saas_orders").select("id").eq("organization_id", s.organization_id).eq("kind", "renovacao").eq("status", "pendente").maybeSingle();
      if (!open) {
        try {
          // Troca pedida pelo titular: o próximo período sai no plano novo, com o preço ATUAL da tabela; senão, preço contratado.
          const target = catalog?.find((p) => p.id === (s.change_request as { plan?: string } | null)?.plan && p.approved);
          const amount = target ? (s.cycle === "anual" && target.price_yearly ? target.price_yearly : target.price_monthly) : s.price;
          const snapshot = target ? { id: target.id, label: target.label, version: target.version, price_monthly: target.price_monthly, price_yearly: target.price_yearly, max_users: target.max_users, features: target.features } : s.plan_snapshot;
          const { data: o } = await db.from("saas_orders").insert({ kind: "renovacao", organization_id: s.organization_id, plan_id: target?.id ?? s.plan_id, cycle: s.cycle, amount, plan_snapshot: snapshot,
            customer: { office: org?.name, email: owner }, history: [{ at: now.toISOString(), text: `Cobrança do período após ${s.current_period_end} emitida${target ? ` (troca para ${target.label})` : ""}` }] }).select("id,order_nsu").single();
          const url = await createCheckout({ orderNsu: o!.order_nsu, items: [{ quantity: 1, price: amount, description: `LexSion ${(snapshot as { label?: string }).label ?? s.plan_id} — ${s.status === "teste" ? "1ª mensalidade" : "renovação"} ${s.cycle === "anual" ? "12 meses" : "1 mês"}` }],
            redirectUrl: `${SITE}/contratar/retorno`, webhookUrl: `${SITE}/api/infinitepay/webhook` });
          await db.from("saas_orders").update({ checkout_url: url }).eq("id", o!.id);
          const trial = s.status === "teste";
          if (owner) await mail(owner, trial ? `LexSion: fim do teste grátis do ${org?.name}` : `LexSion: renovação do ${org?.name}`, `${trial ? `O teste grátis do ${org?.name} termina em` : `A assinatura do ${org?.name} vence em`} ${end.toLocaleDateString("pt-BR")}.${trial ? " Para continuar usando, pague a primeira mensalidade." : ""}\nValor: R$ ${(amount / 100).toFixed(2).replace(".", ",")}${target ? ` (plano ${target.label}, conforme a troca pedida)` : ""}.\nPagar (Pix ou cartão): ${url}\n\nSem pagamento até ${GRACE_DAYS} dias após o vencimento, o acesso é suspenso. Os dados ficam preservados e o acesso volta assim que o pagamento é confirmado.\nO valor e as datas também aparecem em Configurações → Plano.`);
          out.cobrancas++;
        } catch (e) { out.erros.push(`renovação ${s.organization_id.slice(0, 8)}: ${(e as Error).message.slice(0, 80)}`); }
      }
    }
    if (daysLeft < 0 && (s.status === "ativa" || s.status === "teste")) { await db.from("saas_subscriptions").update({ status: "vencida", updated_at: now.toISOString() }).eq("organization_id", s.organization_id); out.vencidos++; }
    if (daysLeft < -GRACE_DAYS && (org?.status === "ativa" || org?.status === "trial")) {
      await db.from("saas_subscriptions").update({ status: "suspensa", updated_at: now.toISOString() }).eq("organization_id", s.organization_id);
      await db.from("organizations").update({ status: "suspensa", status_reason: `Inadimplência: período vencido em ${s.current_period_end}`, updated_at: now.toISOString() }).eq("id", s.organization_id);
      await db.from("audit_logs").insert({ organization_id: s.organization_id, actor_id: null, action: "status", entity: "organizations", entity_id: s.organization_id, detail: `suspensa: inadimplência (${today})` });
      if (owner) await mail(owner, `LexSion: acesso do ${org?.name} suspenso`, `O período venceu em ${end.toLocaleDateString("pt-BR")} e não identificamos o pagamento.\nO acesso está suspenso; nenhum dado foi apagado. Pague pelo link já enviado para reativar na hora, ou responda pelo contato do site.`);
      out.suspensos++;
    }
  }
  // Vigia do backup (outra rotina, horário diferente): backup AUSENTE não gera erro sozinho, então é cobrado aqui.
  const { data: lastOk } = await db.from("audit_logs").select("at").eq("action", "backup.ok").order("at", { ascending: false }).limit(1).maybeSingle();
  if (!lastOk || now.getTime() - Date.parse(lastOk.at) > 36 * 3_600_000) await opsAlert("Backup ausente", `Nenhum backup bem-sucedido nas últimas 36 h (último: ${lastOk?.at ?? "nunca"}). Conferir o agendador lexsion-backup e /admin.`).catch(() => false);
  await db.from("audit_logs").insert({ organization_id: null, actor_id: null, action: out.erros.length ? "cobranca.erro" : "cobranca.ok", entity: "cobranca", entity_id: today, detail: JSON.stringify(out).slice(0, 500) });
  if (out.erros.length) await opsAlert("Rotina de cobrança com erro", out.erros.join("\n")).catch(() => false);
  return NextResponse.json({ ok: true, ...out });
}
