"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Badge, LoadingBlock } from "@/components/ui";
import { formatBRL } from "@/lib/money";
import { formatInstant } from "@/lib/dates";
import { pendingItems, type Clause } from "@/domain/saas-contract";

// Super Admin > Contratos SaaS (operação real): contratos (status, versão, aceite, pagamento), modelos com fluxo de
// aprovação jurídica, dados da contratada e checklist. Leitura pela RLS (plataforma + MFA); ações pela rota auditada.
type Tpl = { id: string; version: string; title: string; status: string; clauses: Clause[]; content_sha256: string; change_reason: string | null; approved_by_name: string | null; approved_at: string | null; published_at: string | null; created_at: string };
type Ctr = { number: string; status: string; plan_id: string; cycle: string; amount: number; party: { kind: string; name?: string; legal_name?: string }; template_status_at_render: string; accepted_at: string | null; created_at: string; document_sha256: string | null };
const TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = { PUBLICADO: "success", APROVADO: "info", REVISAO_JURIDICA: "warning", RASCUNHO: "neutral", ARQUIVADO: "neutral", ACTIVE: "success", TERMS_ACCEPTED: "info", PAYMENT_PENDING: "warning", PAYMENT_CONFIRMED: "success", READY_FOR_REVIEW: "neutral", CANCELED: "danger", EXPIRED: "neutral", FAILED: "danger" };
const CHECK: [string, string][] = [["identidade_contratada", "Identidade da contratada conferida (nome empresarial, CNPJ, endereço)"], ["atividade_fiscal", "Contador(a) confirmou CNAE/emissão fiscal para licenciamento SaaS"], ["conta_infinitepay", "Conta InfinitePay ($marco-boggian) confirmada no CNPJ da contratada"], ["clausulas_criticas", "Cláusulas críticas definidas (reajuste, encargos, reembolso, SLA, retenção, foro)"], ["politicas_consumo", "Políticas de consumo (CDC/arrependimento) revisadas"], ["lgpd_dpa", "LGPD: DPA e suboperadores aprovados"]];
const call = async (body: unknown) => (await fetch("/api/admin/contratos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null)) as { ok: boolean; error?: { message: string } } | null;

export function SaasContracts() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const q = useQuery({
    queryKey: ["saas-contracts"],
    queryFn: async () => {
      const sb = supabaseBrowser();
      const [t, c, s] = await Promise.all([
        sb.from("saas_contract_template_versions").select("*").order("created_at", { ascending: false }),
        sb.from("saas_contracts").select("number,status,plan_id,cycle,amount,party,template_status_at_render,accepted_at,created_at,document_sha256").order("created_at", { ascending: false }).limit(200),
        sb.from("saas_supplier_profile").select("*").eq("id", "vigente").maybeSingle(),
      ]);
      return { tpls: (t.data ?? []) as Tpl[], ctrs: (c.data ?? []) as Ctr[], sup: s.data as Record<string, unknown> | null };
    },
  });
  if (q.isPending) return <LoadingBlock rows={4} />;
  const { tpls, ctrs, sup } = q.data!;
  const run = async (body: Record<string, unknown>, ok: string) => { const r = await call(body); setMsg(r?.ok ? { ok: true, text: ok } : { ok: false, text: r?.error?.message ?? "Sem conexão." }); await qc.invalidateQueries({ queryKey: ["saas-contracts"] }); };
  const pdf = async (number: string) => {
    const r = await fetch("/api/admin/contratos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "contract.pdf", number }) });
    if (!r.ok) return setMsg({ ok: false, text: "PDF indisponível." });
    const url = URL.createObjectURL(await r.blob()); Object.assign(document.createElement("a"), { href: url, download: `contrato-lexsion-${number}.pdf` }).click(); URL.revokeObjectURL(url);
  };
  const checklist = (sup?.checklist ?? {}) as Record<string, { at: string } | undefined>;
  const addr = (sup?.address ?? {}) as Record<string, string>;
  return (
    <div className="space-y-6 text-sm">
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-success" : "text-danger"}>{msg.text}</p>}

      <section className="panel space-y-3 p-4" aria-labelledby="ct-sup">
        <h2 id="ct-sup" className="font-semibold">Contratada (dados do contrato)</h2>
        <p>{String(sup?.legal_name)} · CNPJ {String(sup?.document)} · {String(sup?.legal_nature)} · {String(sup?.size ?? "")}<br />{addr.street}, {addr.number}, {addr.district}, {addr.city}/{addr.uf}, CEP {addr.cep}<br /><span className="text-fg-muted">Fonte: comprovante de CNPJ enviado pelo proprietário (30/10/2026). Conferência cadastral: {sup?.verified_at ? <>feita em {formatInstant(String(sup.verified_at))}</> : <strong className="text-warning">pendente</strong>}.</span></p>
        <SupplierForm sup={sup} onSave={(s) => void run({ action: "supplier.save", supplier: s }, "Dados da contratada salvos e auditados.")} />
        <fieldset className="space-y-1"><legend className="label">Checklist de aprovação comercial, fiscal e jurídica (exigido para publicar)</legend>
          {CHECK.map(([k, label]) => <label key={k} className="flex items-start gap-2"><input type="checkbox" className="mt-1 size-4" checked={!!checklist[k]} onChange={(e) => void run({ action: "supplier.save", supplier: { checklist: { [k]: e.target.checked } } }, "Checklist atualizado.")} />{label}{checklist[k] ? <span className="text-xs text-fg-muted">({formatInstant(checklist[k]!.at)})</span> : null}</label>)}
        </fieldset>
      </section>

      <section className="space-y-3" aria-labelledby="ct-tpl">
        <h2 id="ct-tpl" className="font-semibold">Modelos de contrato</h2>
        {tpls.map((t) => <TemplateCard key={t.id} t={t} onStatus={(to, extra, ok) => void run({ action: "template.status", id: t.id, to, ...extra }, ok)} onDraft={(body) => void run({ action: "template.draft", ...body }, "Nova versão criada como rascunho.")} />)}
      </section>

      <section className="space-y-2" aria-labelledby="ct-list">
        <h2 id="ct-list" className="font-semibold">Contratos ({ctrs.length})</h2>
        <div className="overflow-x-auto" tabIndex={0} aria-label="Contratos SaaS (role horizontalmente)">
          <table className="w-full min-w-[760px]" data-testid="contratos-saas"><caption className="sr-only">Contratos SaaS da LexSion</caption>
            <thead><tr className="text-left text-xs text-fg-muted"><th className="py-1">Nº</th><th>Contratante</th><th>Plano</th><th>Status</th><th>Aceite</th><th>Modelo</th><th>PDF</th></tr></thead>
            <tbody>
              {!ctrs.length && <tr><td colSpan={7} className="py-3 text-fg-muted">Nenhum contrato ainda.</td></tr>}
              {ctrs.map((c) => (
                <tr key={c.number} className="border-t border-line">
                  <td className="py-1.5"><code className="text-xs">{c.number}</code></td>
                  <td>{c.party.kind === "PJ" ? c.party.legal_name : c.party.name} <span className="text-xs text-fg-muted">({c.party.kind})</span></td>
                  <td>{c.plan_id}/{c.cycle} · {formatBRL(c.amount)}</td>
                  <td><Badge tone={TONE[c.status] ?? "neutral"}>{c.status}</Badge></td>
                  <td>{c.accepted_at ? formatInstant(c.accepted_at) : "—"}</td>
                  <td>{c.template_status_at_render === "PUBLICADO" ? "vigente" : "minuta"}</td>
                  <td>{c.accepted_at ? <button className="btn btn-ghost min-h-9" onClick={() => void pdf(c.number)}>Baixar</button> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SupplierForm({ sup, onSave }: { sup: Record<string, unknown> | null; onSave: (s: Record<string, unknown>) => void }) {
  const [email, setEmail] = useState(String(sup?.contact_email ?? "")), [phone, setPhone] = useState(String(sup?.contact_phone ?? "")), [note, setNote] = useState("");
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <label className="block"><span className="label">E-mail para comunicações contratuais</span><input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="canal monitorado" /></label>
      <label className="block"><span className="label">Telefone de contato</span><input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      <label className="block"><span className="label">Evidência da conferência cadastral</span><input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex.: consulta CNPJ na Receita em …" /></label>
      <div className="flex flex-wrap gap-2 sm:col-span-3"><button className="btn btn-secondary" onClick={() => onSave({ contact_email: email, contact_phone: phone })}>Salvar contato</button>
        <button className="btn btn-ghost" disabled={note.trim().length < 10} onClick={() => onSave({ contact_email: email, contact_phone: phone, verified: true, verified_note: note })}>Registrar conferência cadastral</button></div>
    </div>
  );
}

function TemplateCard({ t, onStatus, onDraft }: { t: Tpl; onStatus: (to: string, extra: Record<string, unknown>, ok: string) => void; onDraft: (b: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false), [edit, setEdit] = useState(false);
  const [clauses, setClauses] = useState(t.clauses), [version, setVersion] = useState(""), [reason, setReason] = useState("");
  const [lawyer, setLawyer] = useState(""), [declare, setDeclare] = useState(false);
  const pend = pendingItems(t);
  return (
    <article className="panel space-y-2 p-4" data-testid={`modelo-${t.version}`}>
      <div className="flex flex-wrap items-center gap-2"><strong>Versão {t.version}</strong><Badge tone={TONE[t.status] ?? "neutral"}>{t.status}</Badge><span className="text-xs text-fg-muted">SHA-256 {t.content_sha256.slice(0, 12)}… · {formatInstant(t.created_at)}{t.change_reason ? ` · ${t.change_reason}` : ""}</span></div>
      {t.approved_by_name && <p className="text-xs">Aprovado por {t.approved_by_name} em {formatInstant(t.approved_at!)}{t.published_at ? ` · publicado em ${formatInstant(t.published_at)}` : ""}</p>}
      {pend.length > 0 && <details><summary className="cursor-pointer text-warning">{pend.length} pendência(s) no texto</summary><ul className="mt-1 list-disc pl-5 text-xs">{pend.map((p) => <li key={p}>{p}</li>)}</ul></details>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-ghost min-h-9" onClick={() => setOpen(!open)}>{open ? "Ocultar texto" : "Ver cláusulas"}</button>
        <button className="btn btn-ghost min-h-9" onClick={() => { setEdit(!edit); setClauses(t.clauses); }}>Criar nova versão a partir desta</button>
        {t.status === "RASCUNHO" && <button className="btn btn-secondary min-h-9" onClick={() => onStatus("REVISAO_JURIDICA", {}, "Enviado para revisão jurídica.")}>Enviar para revisão jurídica</button>}
        {t.status === "APROVADO" && <button className="btn btn-primary min-h-9" onClick={() => { if (confirm("Publicar esta versão? Ela passa a valer para NOVAS contratações e libera o aceite público. Contratos já aceitos não mudam.")) onStatus("PUBLICADO", {}, "Versão publicada."); }}>Publicar</button>}
      </div>
      {t.status === "REVISAO_JURIDICA" && (
        <div className="space-y-2 rounded border border-line p-3">
          <p className="font-medium">Aprovação jurídica (somente o(a) advogado(a) responsável)</p>
          <label className="block"><span className="label">Nome e OAB do(a) advogado(a)</span><input className="field" value={lawyer} onChange={(e) => setLawyer(e.target.value)} placeholder="Nome completo — OAB 000000/UF" /></label>
          <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 size-4" checked={declare} onChange={(e) => setDeclare(e.target.checked)} /> Declaro que revisei integralmente este texto e o aprovo para uso, inclusive as pendências indicadas.</label>
          <div className="flex gap-2"><button className="btn btn-secondary min-h-9" disabled={!declare || lawyer.length < 5} onClick={() => onStatus("APROVADO", { lawyer, declare }, "Versão aprovada.")}>Aprovar versão</button><button className="btn btn-ghost min-h-9" onClick={() => onStatus("RASCUNHO", { note: "devolvida para ajustes" }, "Devolvida para rascunho.")}>Devolver para ajustes</button></div>
        </div>
      )}
      {open && <ol className="space-y-2">{t.clauses.map((c) => <li key={c.n + c.title}><strong>{c.n ? `${c.n}. ` : ""}{c.title}</strong><p className="whitespace-pre-wrap text-fg-muted">{c.body}</p></li>)}</ol>}
      {edit && (
        <div className="space-y-2 rounded border border-line p-3">
          {clauses.map((c, i) => <label key={i} className="block"><span className="label">{c.n ? `${c.n}. ` : ""}{c.title}</span><textarea className="field min-h-24 py-2" value={c.body} onChange={(e) => setClauses(clauses.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} /></label>)}
          <div className="grid gap-2 sm:grid-cols-2"><label className="block"><span className="label">Número da nova versão</span><input className="field" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="ex.: 2026.11-1" /></label><label className="block"><span className="label">Motivo da alteração</span><input className="field" value={reason} onChange={(e) => setReason(e.target.value)} /></label></div>
          <button className="btn btn-secondary" onClick={() => onDraft({ version, reason, title: t.title, clauses })}>Salvar como rascunho</button>
        </div>
      )}
    </article>
  );
}
