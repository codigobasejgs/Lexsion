"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Badge, LoadingBlock } from "@/components/ui";
import { formatBRL } from "@/lib/money";
import { formatInstant } from "@/lib/dates";
import { CONDITIONS, missingConditions, pendingItems, type Clause, type ConditionKey } from "@/domain/saas-contract";

// Super Admin > Contratos SaaS (operação real): contratos de assinatura da LexSion gerados AUTOMATICAMENTE com os dados
// do cadastro e as condições configuradas. Sem aprovação manual. Seções: dados da plataforma, condições contratuais,
// modelo/versões e contratos emitidos (+ reconciliação). Leitura pela RLS (plataforma); ações pela rota auditada.
type Tpl = { id: string; template_key: string; version: string; title: string; status: string; clauses: Clause[]; content_sha256: string; change_reason: string | null; approved_by_name: string | null; approved_at: string | null; published_at: string | null; created_at: string };
type Ctr = { number: string; status: string; plan_id: string; cycle: string; amount: number; party: { kind: string; name?: string; legal_name?: string }; template_status_at_render: string; accepted_at: string | null; created_at: string; superseded_by: string | null; body_text: string | null };
type Rec = { contrato: string; criado_em: string; classe: string; acao: string; canonico: string | null };
const TPL_LABEL: Record<string, [string, "success" | "neutral" | "warning"]> = { PUBLICADO: ["Em uso", "success"], ARQUIVADO: ["Substituída", "neutral"], APROVADO: ["Histórico (aprovada)", "neutral"], REVISAO_JURIDICA: ["Histórico (antiga)", "neutral"], RASCUNHO: ["Rascunho", "neutral"] };
const CTR_LABEL: Record<string, [string, "success" | "warning" | "danger" | "neutral" | "info"]> = {
  READY_FOR_REVIEW: ["Aguardando aceite", "warning"], DRAFT: ["Em preenchimento", "neutral"], TERMS_ACCEPTED: ["Aceito", "info"], PAYMENT_PENDING: ["Aceito · aguardando pagamento", "warning"],
  PAYMENT_CONFIRMED: ["Aceito · ativando", "info"], ACTIVE: ["Aceito · escritório ativo", "success"], SUPERSEDED: ["Substituído", "neutral"], EXPIRED: ["Expirado sem aceite", "neutral"], CANCELED: ["Cancelado", "danger"], FAILED: ["Falhou", "danger"],
};
const call = async (body: unknown) => (await fetch("/api/admin/contratos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null)) as { ok: boolean; data?: unknown; error?: { message: string } } | null;

export function SaasContracts() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rec, setRec] = useState<Rec[] | null>(null);
  const q = useQuery({
    queryKey: ["saas-contracts"],
    queryFn: async () => {
      const sb = supabaseBrowser();
      const [t, c, s] = await Promise.all([
        sb.from("saas_contract_template_versions").select("*").order("created_at", { ascending: false }),
        sb.from("saas_contracts").select("number,status,plan_id,cycle,amount,party,template_status_at_render,accepted_at,created_at,superseded_by,body_text").order("created_at", { ascending: false }).limit(200),
        sb.from("saas_supplier_profile").select("*").eq("id", "vigente").maybeSingle(),
      ]);
      return { tpls: ((t.data ?? []) as Tpl[]).filter((x) => x.template_key === "saas-lexsion"), ctrs: (c.data ?? []) as Ctr[], sup: s.data as Record<string, unknown> | null };
    },
  });
  if (q.isPending) return <LoadingBlock rows={4} />;
  const { tpls, ctrs, sup } = q.data!;
  const run = async (body: Record<string, unknown>, ok: string) => { const r = await call(body); setMsg(r?.ok ? { ok: true, text: ok } : { ok: false, text: r?.error?.message ?? "Sem conexão." }); await qc.invalidateQueries({ queryKey: ["saas-contracts"] }); return r; };
  const pdf = async (number: string) => {
    const r = await fetch("/api/admin/contratos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "contract.pdf", number }) });
    if (!r.ok) return setMsg({ ok: false, text: ((await r.json().catch(() => null)) as { error?: { message: string } } | null)?.error?.message ?? "PDF indisponível." });
    const url = URL.createObjectURL(await r.blob()); Object.assign(document.createElement("a"), { href: url, download: `contrato-lexsion-${number}.pdf` }).click(); URL.revokeObjectURL(url);
  };
  const addr = (sup?.address ?? {}) as Record<string, string>;
  const missing = sup ? missingConditions({ contact_email: (sup.contact_email as string) ?? null, conditions: sup.conditions as Partial<Record<ConditionKey, string>> }) : [];
  const live = tpls.find((t) => t.status === "PUBLICADO");
  const reconcile = async (apply: boolean) => { const r = await run({ action: "reconcile", apply }, apply ? "Reconciliação aplicada e auditada." : "Prévia da reconciliação gerada (nada foi alterado)."); if (r?.ok) setRec(r.data as Rec[]); };
  return (
    <div className="space-y-6 text-sm">
      <p className="text-fg-muted">Contratos de assinatura da LexSion, gerados automaticamente com os dados do cadastro e as condições configuradas. Acompanhe versões, aceites e documentos.</p>
      <div aria-live="polite">{msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-success" : "text-danger"}>{msg.text}</p>}</div>
      <section className={`panel space-y-1 p-4 ${missing.length ? "border-warning/50" : ""}`} data-testid="situacao-contratacao">
        <h2 className="font-semibold">Situação da contratação online</h2>
        {missing.length ? <><p className="text-warning">Novos contratos ainda não podem ser aceitos: falta configurar {missing.length} campo(s) abaixo, em “Condições contratuais”. O cadastro de quem tentar contratar fica salvo e continua de onde parou quando a configuração for concluída.</p><ul className="list-disc pl-5 text-warning">{missing.map((m) => <li key={m.key}>{m.label}</li>)}</ul></> : <p className="text-success">Pronta: novos contratos são gerados e podem ser aceitos automaticamente{live ? ` (modelo ${live.version})` : ""}.</p>}
      </section>

      <section className="panel space-y-3 p-4" aria-labelledby="ct-sup">
        <h2 id="ct-sup" className="font-semibold">Dados da plataforma (contratada)</h2>
        <p>{String(sup?.legal_name)} · CNPJ {String(sup?.document)} · {String(sup?.legal_nature)} · {String(sup?.size ?? "")}<br />{addr.street}, {addr.number}, {addr.district}, {addr.city}/{addr.uf}, CEP {addr.cep}<br /><span className="text-fg-muted">Fonte: comprovante de CNPJ enviado pelo proprietário (30/10/2026).</span></p>
      </section>

      <ConditionsForm sup={sup} onSave={(s) => void run({ action: "conditions.save", supplier: s }, "Condições salvas. Novos contratos já usam estes valores.")} />

      <section className="space-y-3" aria-labelledby="ct-tpl">
        <h2 id="ct-tpl" className="font-semibold">Modelo do contrato e versões</h2>
        {tpls.map((t) => <TemplateCard key={t.id} t={t} onSave={(body) => void run({ action: "template.save", ...body }, "Nova versão salva e já em uso para novos contratos.")} />)}
      </section>

      <section className="space-y-2" aria-labelledby="ct-list">
        <div className="flex flex-wrap items-center gap-2"><h2 id="ct-list" className="flex-1 font-semibold">Contratos emitidos ({ctrs.length})</h2>
          <button className="btn btn-ghost min-h-9" onClick={() => void reconcile(false)}>Prévia da reconciliação</button></div>
        {rec && (
          <div className="panel space-y-2 p-3" data-testid="reconciliacao">
            <p className="text-xs text-fg-muted">Só prévias não aceitas mudam: as antigas do mesmo titular e plano viram “Substituído” (ligadas à mais nova) e as vencidas viram “Expirado sem aceite”. Contratos aceitos, com pedido ou escritório nunca mudam.</p>
            <ul className="text-xs">{rec.map((r) => <li key={r.contrato}><code>{r.contrato}</code> · {r.classe.replace(/_/g, " ")} · {r.acao}{r.canonico ? ` → ${r.canonico}` : ""}</li>)}</ul>
            {rec.some((r) => r.acao.startsWith("a aplicar")) && <button className="btn btn-secondary min-h-9" onClick={() => { if (confirm("Aplicar a reconciliação mostrada? Nada é apagado; fica registrado na auditoria.")) void reconcile(true); }}>Aplicar reconciliação</button>}
          </div>
        )}
        <div className="overflow-x-auto" tabIndex={0} aria-label="Contratos SaaS (role horizontalmente)">
          <table className="w-full min-w-[760px]" data-testid="contratos-saas"><caption className="sr-only">Contratos SaaS da LexSion</caption>
            <thead><tr className="text-left text-xs text-fg-muted"><th className="py-1">Nº</th><th>Contratante</th><th>Plano</th><th>Situação</th><th>Aceite</th><th>PDF</th></tr></thead>
            <tbody>
              {!ctrs.length && <tr><td colSpan={6} className="py-3 text-fg-muted">Nenhum contrato ainda.</td></tr>}
              {ctrs.map((c) => {
                const [label, tone] = CTR_LABEL[c.status] ?? [c.status, "neutral"];
                const blocked = !c.accepted_at && c.status === "READY_FOR_REVIEW" && (c.template_status_at_render !== "PUBLICADO" || /\[PENDENTE/.test(c.body_text ?? ""));
                return (
                  <tr key={c.number} className="border-t border-line">
                    <td className="py-1.5"><code className="text-xs">{c.number}</code></td>
                    <td>{c.party.kind === "PJ" ? c.party.legal_name : c.party.name} <span className="text-xs text-fg-muted">({c.party.kind})</span></td>
                    <td>{c.plan_id}/{c.cycle} · {formatBRL(c.amount)}</td>
                    <td><Badge tone={tone}>{label}</Badge>{blocked && <span className="block text-xs text-fg-muted">gerado antes da configuração completa: ao salvar os dados de novo, o contratante recebe o texto atualizado</span>}</td>
                    <td>{c.accepted_at ? formatInstant(c.accepted_at) : "—"}</td>
                    <td>{c.accepted_at ? <button className="btn btn-ghost min-h-9" onClick={() => void pdf(c.number)}>Baixar</button> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ConditionsForm({ sup, onSave }: { sup: Record<string, unknown> | null; onSave: (s: Record<string, unknown>) => void }) {
  const cur = (sup?.conditions ?? {}) as Partial<Record<ConditionKey, string>>;
  const [email, setEmail] = useState(String(sup?.contact_email ?? "")), [phone, setPhone] = useState(String(sup?.contact_phone ?? ""));
  const [c, setC] = useState<Partial<Record<ConditionKey, string>>>(cur);
  return (
    <section className="panel space-y-3 p-4" aria-labelledby="ct-cond">
      <h2 id="ct-cond" className="font-semibold">Condições contratuais da plataforma</h2>
      <p className="text-fg-muted">Preenchidas uma vez e usadas em todos os novos contratos (entram no texto exatamente como escritas). Não são dados do contratante.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block"><span className="label">E-mail oficial de atendimento e comunicações contratuais</span><input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="caixa que recebe e é monitorada" /></label>
        <label className="block"><span className="label">Telefone de contato (opcional)</span><input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      </div>
      {(Object.keys(CONDITIONS) as ConditionKey[]).map((k) => (
        <label key={k} className="block"><span className="label">{CONDITIONS[k].label}</span><textarea className="field min-h-16 py-2" value={c[k] ?? ""} onChange={(e) => setC({ ...c, [k]: e.target.value })} placeholder={CONDITIONS[k].hint} /></label>
      ))}
      <button className="btn btn-secondary" onClick={() => onSave({ contact_email: email, contact_phone: phone, conditions: Object.fromEntries((Object.keys(CONDITIONS) as ConditionKey[]).map((k) => [k, c[k] ?? ""])) })}>Salvar condições</button>
    </section>
  );
}

function TemplateCard({ t, onSave }: { t: Tpl; onSave: (b: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false), [edit, setEdit] = useState(false);
  const [clauses, setClauses] = useState(t.clauses), [version, setVersion] = useState(""), [reason, setReason] = useState("");
  const pend = pendingItems({ clauses });
  const [label, tone] = TPL_LABEL[t.status] ?? [t.status, "neutral"];
  return (
    <article className="panel space-y-2 p-4" data-testid={`modelo-${t.version}`}>
      <div className="flex flex-wrap items-center gap-2"><strong>Versão {t.version}</strong><Badge tone={tone}>{label}</Badge><span className="text-xs text-fg-muted">SHA-256 {t.content_sha256.slice(0, 12)}… · {formatInstant(t.created_at)}{t.change_reason ? ` · ${t.change_reason}` : ""}</span></div>
      {t.approved_by_name && <p className="text-xs text-fg-muted">Registro histórico: aprovada por {t.approved_by_name} em {formatInstant(t.approved_at!)}.</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-ghost min-h-9" onClick={() => setOpen(!open)}>{open ? "Ocultar texto" : "Ver cláusulas"}</button>
        {t.status === "PUBLICADO" && <button className="btn btn-ghost min-h-9" onClick={() => { setEdit(!edit); setClauses(t.clauses); }}>Editar e salvar nova versão</button>}
      </div>
      {open && <ol className="space-y-2">{t.clauses.map((c) => <li key={c.n + c.title}><strong>{c.n ? `${c.n}. ` : ""}{c.title}</strong><p className="whitespace-pre-wrap text-fg-muted">{c.body}</p></li>)}</ol>}
      {edit && (
        <div className="space-y-2 rounded border border-line p-3">
          <p className="text-xs text-fg-muted">Ao salvar, a nova versão passa a valer para NOVOS contratos. Contratos já gerados guardam o próprio texto; aceitos nunca mudam. Use {"{{condicao.…}}"} e os demais campos {"{{…}}"} em vez de valores fixos.</p>
          {clauses.map((c, i) => <label key={i} className="block"><span className="label">{c.n ? `${c.n}. ` : ""}{c.title}</span><textarea className="field min-h-24 py-2" value={c.body} onChange={(e) => setClauses(clauses.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} /></label>)}
          {pend.length > 0 && <p role="alert" className="text-danger">Ainda há “[PENDENTE” no texto: {pend.join("; ")}.</p>}
          <div className="grid gap-2 sm:grid-cols-2"><label className="block"><span className="label">Número da nova versão</span><input className="field" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="ex.: 2026.11-2" /></label><label className="block"><span className="label">Motivo da alteração</span><input className="field" value={reason} onChange={(e) => setReason(e.target.value)} /></label></div>
          <button className="btn btn-primary" disabled={!!pend.length || version.trim().length < 3 || reason.trim().length < 5} onClick={() => onSave({ version, reason, title: t.title, clauses })}>Salvar nova versão</button>
        </div>
      )}
    </article>
  );
}
