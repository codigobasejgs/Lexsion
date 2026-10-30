"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarPlus, Gift, Layers, Mail, Pause, Play, Users } from "lucide-react";
import { Badge, Dialog, LoadingBlock } from "@/components/ui";
import { formatBRL } from "@/lib/money";
import { act, daysLeft, fmtDate, fmtDateTime, lifecycle, loadOrgs, loadTimeline, myPlatformRole, type OrgRow } from "./real-api";

// Ficha 360º do escritório (operação real). Ações chamam funções do banco que conferem papel + MFA, travam a linha,
// checam a versão (outra pessoa alterou? recusa) e auditam antes/depois/motivo. Nada é otimista: a tela recarrega
// do banco depois de cada ação. Conteúdo jurídico do escritório NÃO é lido aqui.
type Action = "trial" | "courtesy" | "plan" | "status" | "limit" | "invite";
const PLANS = ["solo", "profissional", "elite", "trial", "essencial", "avancado", "enterprise"];
const GRANT_LABEL: Record<string, string> = { concessao: "Teste concedido", extensao: "Teste prorrogado", data_definida: "Fim do teste definido", reativacao: "Teste reativado", encerramento: "Teste encerrado", cortesia: "Cortesia concedida", fim_cortesia: "Cortesia encerrada", expiracao_automatica: "Teste expirou (rotina)" };

export function Org360({ id }: { id: string }) {
  const qc = useQueryClient();
  const orgs = useQuery({ queryKey: ["platform-orgs"], queryFn: loadOrgs });
  const tl = useQuery({ queryKey: ["platform-tl", id], queryFn: () => loadTimeline(id) });
  const role = useQuery({ queryKey: ["platform-role"], queryFn: myPlatformRole });
  const [open, setOpen] = useState<Action | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tab, setTab] = useState("resumo");
  if (orgs.isPending || tl.isPending) return <LoadingBlock rows={5} />;
  const o = orgs.data?.find((x) => x.id === id);
  if (!o) return <p className="panel p-5 text-sm">Escritório não encontrado. <Link href="/admin/organizacoes" className="text-accent underline">Voltar à lista</Link></p>;
  const t = tl.data!;
  const s = lifecycle(o);
  const r = role.data ?? "";
  const canOps = r === "superadmin" || r === "platform_admin";
  const done = async (res: { ok: boolean; message?: string }, okText: string) => {
    setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.message ?? "Não concluído." });
    if (res.ok) setOpen(null);
    await Promise.all([qc.invalidateQueries({ queryKey: ["platform-orgs"] }), qc.invalidateQueries({ queryKey: ["platform-tl", id] }), qc.invalidateQueries({ queryKey: ["platform-metrics"] })]);
  };
  const btn = (a: Action, label: string, Icon: typeof Play, show = true) => show ? <button className="btn btn-secondary min-h-10" onClick={() => { setMsg(null); setOpen(a); }} disabled={!canOps && a !== "invite"}><Icon aria-hidden className="size-4" /> {label}</button> : null;
  return (
    <div className="space-y-5">
      <Link href="/admin/organizacoes" className="btn btn-ghost -ml-3"><ArrowLeft aria-hidden className="size-4" /> Todos os escritórios</Link>
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1"><h1 className="text-2xl font-semibold">{o.name}</h1><p className="text-sm text-fg-muted">/{o.slug} · criado em {fmtDate(o.created_at)}{o.origem ? ` · origem: ${o.origem}` : ""}</p></div>
        <Badge tone={s.tone}>{s.label}</Badge>
      </header>
      {!canOps && <p className="rounded border border-info/30 bg-info-bg p-3 text-sm text-info">Seu papel ({r || "sem papel"}) é de consulta: as ações de alteração ficam desabilitadas e o banco também as recusa.</p>}
      <div className="flex flex-wrap gap-2" aria-label="Ações">
        {btn("trial", o.status === "trial" ? "Estender teste" : "Teste grátis", CalendarPlus)}
        {btn("plan", "Alterar plano", Layers)}
        {btn("courtesy", "Cortesia", Gift, r === "superadmin")}
        {btn("status", o.status === "suspensa" || o.status === "cancelada" ? "Reativar" : "Suspender / cancelar", o.status === "suspensa" ? Play : Pause)}
        {btn("limit", "Limite de usuários", Users)}
        {btn("invite", "Reenviar acesso ao titular", Mail)}
      </div>
      <div aria-live="polite">{msg && <p role={msg.ok ? "status" : "alert"} className={`rounded p-3 text-sm ${msg.ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>{msg.text}</p>}</div>
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-line">
        {[["resumo", "Resumo"], ["assinatura", "Assinatura e concessões"], ["equipe", "Titular e equipe"], ["historico", "Histórico e auditoria"]].map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-10 px-3 text-sm ${tab === k ? "border-b-2 border-brand font-medium" : "text-fg-muted"}`}>{l}</button>)}
      </div>
      {tab === "resumo" && (
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3" data-testid="ficha-resumo">
          {[["Situação no banco", `${o.status}${o.status_reason ? ` — ${o.status_reason}` : ""}`], ["Plano", `${o.plan}${o.sub_cycle ? ` · ${o.sub_cycle}` : ""}`], ["Teste grátis até", o.trial_ends_at ? `${fmtDateTime(o.trial_ends_at)} (${daysLeft(o.trial_ends_at)} dias)` : "—"],
            ["Cortesia até", o.courtesy_until ? fmtDateTime(o.courtesy_until) : "—"], ["Usuários / limite", `${o.members} / ${o.max_users ?? "sem limite contratado"}`], ["Clientes cadastrados (contagem)", String(o.clients)],
            ["Arquivos", `${(o.storage_bytes / 1024 / 1024).toFixed(1)} MB`], ["Última atividade registrada", fmtDateTime(o.last_activity)], ["Aplicativo (PWA) com ícone próprio", o.has_pwa_icon ? "Sim" : "Não"],
            ["Assinatura", o.sub_status ?? "sem assinatura pelo site"], ["Preço contratado", o.sub_price != null ? formatBRL(o.sub_price) : "restrito ou —"], ["Próximo vencimento", o.period_end ? fmtDate(o.period_end) : "—"]].map(([k, v]) =>
            <div key={k} className="panel p-3"><dt className="text-xs text-fg-muted">{k}</dt><dd className="mt-0.5">{v}</dd></div>)}
        </dl>
      )}
      {tab === "assinatura" && (
        <div className="space-y-4 text-sm">
          <section className="panel p-4"><h2 className="mb-2 font-semibold">Concessões (teste e cortesia)</h2>
            {!t.grants.length ? <p className="text-fg-muted">Nenhuma concessão.</p> : <ul className="space-y-1">{t.grants.map((g, i) => <li key={i}><strong>{GRANT_LABEL[g.kind] ?? g.kind}</strong> · {fmtDate(g.old_end)} → {fmtDate(g.new_end)}{g.days ? ` (+${g.days} d)` : ""} · {g.reason} <span className="text-fg-muted">({fmtDateTime(g.created_at)})</span></li>)}</ul>}
            <p className="mt-2 text-xs text-fg-muted">Concessões não são pagamento e não entram na receita.</p>
          </section>
          <section className="panel p-4"><h2 className="mb-2 font-semibold">Pagamentos e pedidos (assinatura LexSion)</h2>
            {!t.orders.length ? <p className="text-fg-muted">Nenhum pedido.</p> : <ul className="space-y-1">{t.orders.map((x) => <li key={x.order_nsu}>{x.kind} · {formatBRL(x.amount)} · <Badge tone={x.status === "pago" ? "success" : x.status === "pendente" ? "warning" : "neutral"}>{x.status}</Badge> · {x.paid_at ? `pago em ${fmtDateTime(x.paid_at)}` : `criado em ${fmtDate(x.created_at)}`} · ativação {x.activation}</li>)}</ul>}
          </section>
          <section className="panel p-4"><h2 className="mb-2 font-semibold">Limites extras</h2>
            {!t.overrides.length ? <p className="text-fg-muted">Nenhum.</p> : <ul>{t.overrides.map((v, i) => <li key={i}>{v.value} usuários{v.until ? ` até ${fmtDate(v.until)}` : ""} · {v.reason}{v.revoked_at ? ` · revogado em ${fmtDate(v.revoked_at)}` : " · vigente"}</li>)}</ul>}
          </section>
          <section className="panel p-4"><h2 className="mb-2 font-semibold">Contratos SaaS</h2>
            {!t.contracts.length ? <p className="text-fg-muted">Nenhum contrato aceito pelo site.</p> : <ul>{t.contracts.map((c) => <li key={c.number}>{c.number} · {c.status} · {c.accepted_at ? `aceito em ${fmtDateTime(c.accepted_at)}` : "não aceito"}</li>)}</ul>}
          </section>
        </div>
      )}
      {tab === "equipe" && (
        <section className="panel p-4 text-sm"><h2 className="mb-2 font-semibold">Pessoas do escritório (metadados)</h2>
          <ul className="divide-y divide-line">{t.team.map((m, i) => <li key={i} className="flex flex-wrap gap-x-3 py-2"><strong>{m.name}</strong><span>{m.role === "admin" ? "Titular" : m.role}</span><span className="text-fg-muted">{m.email}</span><span className="text-fg-muted">{m.last_sign_in ? `último acesso ${fmtDateTime(m.last_sign_in)}` : m.confirmed ? "nunca entrou" : "convite não aceito"}</span></li>)}</ul>
          <p className="mt-2 text-xs text-fg-muted">A equipe é gerida pelo titular do escritório. A plataforma não vê casos, documentos nem conversas.</p>
        </section>
      )}
      {tab === "historico" && (
        <section className="panel p-4 text-sm" data-testid="ficha-historico"><h2 className="mb-2 font-semibold">Histórico (auditoria imutável)</h2>
          {!t.events.length ? <p className="text-fg-muted">Sem eventos.</p> : <ol className="space-y-2">{t.events.map((e, i) => <li key={i} className="border-l-2 border-line pl-3"><span className="num text-xs text-fg-muted">{fmtDateTime(e.at)}</span> · <code className="text-xs">{e.action}</code> · {e.detail}{e.reason ? <span className="block text-fg-muted">Motivo: {e.reason}</span> : null}<span className="block text-xs text-fg-muted">{e.actor ? `${e.actor}${e.actor_role ? ` (${e.actor_role})` : ""}` : "sistema"}</span></li>)}</ol>}
        </section>
      )}
      <ActionDialog org={o} action={open} onClose={() => setOpen(null)} onDone={done} />
    </div>
  );
}

function ActionDialog({ org, action, onClose, onDone }: { org: OrgRow; action: Action | null; onClose: () => void; onDone: (r: { ok: boolean; message?: string }, ok: string) => void }) {
  const [reason, setReason] = useState(""), [days, setDays] = useState(7), [custom, setCustom] = useState(""), [until, setUntil] = useState(""), [op, setOp] = useState(""), [plan, setPlan] = useState(org.plan), [mode, setMode] = useState("imediato"), [status, setStatus] = useState("suspensa"), [value, setValue] = useState(""), [busy, setBusy] = useState(false);
  // Mesma chave e mesmo "agora" enquanto o modal está aberto: duplo clique não duplica e a prévia é estável.
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [now] = useState(() => Date.now());
  const close = () => { setReason(""); setCustom(""); setUntil(""); setOp(""); setValue(""); setKey(crypto.randomUUID()); onClose(); };
  const endOfDay = (d: string) => (d ? new Date(`${d}T23:59:59-03:00`).toISOString() : null);
  const trialOp = op || (org.status === "trial" ? "prorrogar" : org.trial_ends_at ? "reativar" : "conceder");
  const n = custom ? Number(custom) : days;
  const base = trialOp === "prorrogar" && org.trial_ends_at && Date.parse(org.trial_ends_at) > now ? Date.parse(org.trial_ends_at) : now;
  const preview = trialOp === "definir" ? (until ? fmtDate(endOfDay(until)) : "—") : trialOp === "encerrar" ? "agora (acesso suspenso)" : fmtDate(new Date(base + n * 86_400_000).toISOString());
  const send = async (body: Record<string, unknown>, ok: string) => { setBusy(true); const r = await act({ org: org.id, expected: org.updated_at, key, reason, ...body }); setBusy(false); onDone(r, ok); if (r.ok) close(); };
  const reasonField = <label className="block"><span className="label">Motivo (obrigatório, vai para a auditoria)</span><input className="field" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></label>;
  const footer = (go: () => void, label: string, danger = false) => (
    <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn btn-ghost" onClick={close}>Cancelar</button><button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} disabled={busy || reason.trim().length < 5} onClick={go}>{busy ? "Gravando…" : label}</button></div>
  );
  const box = (a: string, b: string, note: string) => <div className="my-3 grid grid-cols-2 gap-2 rounded border border-line p-3 text-sm"><div><span className="block text-xs text-fg-muted">Antes</span>{a}</div><div><span className="block text-xs text-fg-muted">Depois</span><strong>{b}</strong></div><p className="col-span-2 text-xs text-fg-muted">{note}</p></div>;
  return (
    <>
      <Dialog open={action === "trial"} onClose={close} title={`Teste grátis — ${org.name}`}>
        <fieldset className="flex flex-wrap gap-2 text-sm"><legend className="label">Operação</legend>{[["conceder", "Conceder"], ["prorrogar", "Prorrogar"], ["definir", "Definir data final"], ["reativar", "Reativar vencido"], ["encerrar", "Encerrar agora"]].map(([k, l]) => <label key={k} className="flex items-center gap-1"><input type="radio" name="op" checked={trialOp === k} onChange={() => setOp(k)} /> {l}</label>)}</fieldset>
        {["conceder", "prorrogar", "reativar"].includes(trialOp) && <div className="mt-3 flex flex-wrap items-end gap-2">{[3, 7, 15, 30].map((d) => <button key={d} type="button" className={`btn min-h-9 ${!custom && days === d ? "btn-primary" : "btn-ghost border border-line"}`} onClick={() => { setDays(d); setCustom(""); }}>+{d} dias</button>)}<label className="block"><span className="label">Outro (1–365)</span><input className="field w-24" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 3))} /></label></div>}
        {trialOp === "definir" && <label className="mt-3 block"><span className="label">Último dia do teste</span><input type="date" className="field" value={until} onChange={(e) => setUntil(e.target.value)} /></label>}
        {box(org.trial_ends_at ? `Teste até ${fmtDate(org.trial_ends_at)}` : "Sem teste", trialOp === "encerrar" ? "Teste encerrado" : `Teste até ${preview}`, "Nenhuma cobrança é gerada. O acesso segue a nova data no banco imediatamente.")}
        {reasonField}
        {footer(() => void send({ action: "trial", op: trialOp, days: n, until: trialOp === "definir" ? endOfDay(until) : null }, `Teste atualizado: ${trialOp === "encerrar" ? "encerrado" : `até ${preview}`}.`), "Confirmar", trialOp === "encerrar")}
      </Dialog>
      <Dialog open={action === "courtesy"} onClose={close} title={`Cortesia — ${org.name}`}>
        <p className="text-sm">Acesso sem pagamento, por tempo limitado. <strong>Não é receita</strong> e não aparece como pago.</p>
        <fieldset className="mt-2 flex gap-3 text-sm"><label className="flex items-center gap-1"><input type="radio" name="cop" checked={(op || "conceder") === "conceder"} onChange={() => setOp("conceder")} /> Conceder</label><label className="flex items-center gap-1"><input type="radio" name="cop" checked={op === "encerrar"} onChange={() => setOp("encerrar")} disabled={!org.courtesy_until} /> Encerrar</label></fieldset>
        {(op || "conceder") === "conceder" && <label className="mt-3 block"><span className="label">Válida até</span><input type="date" className="field" value={until} onChange={(e) => setUntil(e.target.value)} /></label>}
        {box(org.courtesy_until ? `Cortesia até ${fmtDate(org.courtesy_until)}` : "Sem cortesia", (op || "conceder") === "conceder" ? `Cortesia até ${until ? fmtDate(endOfDay(until)) : "—"}` : "Sem cortesia (suspende se não houver assinatura paga)", "Ao vencer, a rotina diária suspende o acesso sem apagar dados.")}
        {reasonField}
        {footer(() => void send({ action: "courtesy", op: op || "conceder", until: endOfDay(until) }, "Cortesia atualizada."), "Confirmar")}
      </Dialog>
      <Dialog open={action === "plan"} onClose={close} title={`Plano — ${org.name}`}>
        <label className="block"><span className="label">Novo plano</span><select className="field" value={plan} onChange={(e) => setPlan(e.target.value)}>{PLANS.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
        {org.sub_status === "ativa" && <fieldset className="mt-3 text-sm"><legend className="label">Quando vale</legend><label className="flex items-center gap-1"><input type="radio" checked={mode === "imediato"} onChange={() => setMode("imediato")} /> Agora (limites já; preço contratado mantido até a renovação)</label><label className="flex items-center gap-1"><input type="radio" checked={mode === "proxima_renovacao"} onChange={() => setMode("proxima_renovacao")} /> Na próxima renovação</label></fieldset>}
        {box(org.plan, plan, "Nenhuma cobrança é emitida por esta ação. A diferença de preço, se houver, entra na próxima cobrança do período (link enviado ao titular).")}
        {reasonField}
        {footer(() => void send({ action: "plan", plan, mode }, `Plano alterado para ${plan}.`), "Confirmar")}
      </Dialog>
      <Dialog open={action === "status"} onClose={close} title={`Situação — ${org.name}`}>
        <fieldset className="flex flex-wrap gap-3 text-sm"><legend className="label">Nova situação</legend>{(org.status === "suspensa" || org.status === "cancelada" ? [["ativa", "Reativar"]] : [["suspensa", "Suspender"], ["cancelada", "Cancelar"]]).map(([k, l]) => <label key={k} className="flex items-center gap-1"><input type="radio" checked={(org.status === "suspensa" || org.status === "cancelada" ? "ativa" : status) === k} onChange={() => setStatus(k)} /> {l}</label>)}</fieldset>
        {box(org.status, org.status === "suspensa" || org.status === "cancelada" ? "ativa ou teste (conforme o direito vigente)" : status, "Nenhum dado é apagado. Suspenso/cancelado: a equipe vê “Acesso suspenso” e o banco bloqueia as gravações. Reativar só é aceito com teste, cortesia ou pagamento vigente.")}
        {reasonField}
        {footer(() => void send({ action: "status", status: org.status === "suspensa" || org.status === "cancelada" ? "ativa" : status }, "Situação atualizada."), "Confirmar", status !== "ativa" && org.status !== "suspensa")}
      </Dialog>
      <Dialog open={action === "limit"} onClose={close} title={`Limite de usuários — ${org.name}`}>
        <div className="grid gap-2 sm:grid-cols-2"><label className="block"><span className="label">Novo limite (vazio = revogar extra)</span><input className="field" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 4))} /></label><label className="block"><span className="label">Válido até (opcional)</span><input type="date" className="field" value={until} onChange={(e) => setUntil(e.target.value)} /></label></div>
        {box(`${org.max_users ?? "sem limite"} usuários`, value ? `${value} usuários${until ? ` até ${fmtDate(endOfDay(until))}` : ""}` : "limite do plano", "Aplicado pelo banco ao convidar pessoas. Sem cobrança.")}
        {reasonField}
        {footer(() => void send({ action: "limit", value: value ? Number(value) : null, until: endOfDay(until) }, "Limite atualizado."), "Confirmar")}
      </Dialog>
      <Dialog open={action === "invite"} onClose={close} title={`Reenviar acesso — ${org.name}`}>
        <p className="text-sm">Envia ao titular ({org.owner_email ?? "—"}) o e-mail para {org.owner_last_sign_in ? "redefinir a senha" : "aceitar o convite e criar a senha"}.</p>
        {reasonField}
        {footer(() => void send({ action: "invite" }, "E-mail de acesso enviado ao titular."), "Enviar")}
      </Dialog>
    </>
  );
}
