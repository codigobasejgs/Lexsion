"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, HardDrive, Monitor, Moon, Palette, RotateCcw, Sun } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { Badge, Dialog, PageHeader } from "@/components/ui";
import { InstallCard } from "@/components/pwa";
import { Feedback, useAction, useUrlState } from "@/modules/shared";
import { storageMode, readAll } from "@/services/mock/db";
import { updateRow } from "@/services/mock/generic";
import { ALL_AREAS } from "@/domain/areas";
import { downloadText } from "@/domain/csv";
import { formatCivil, formatInstant } from "@/lib/dates";
import type { OrgSettings } from "@/domain/types";
import { useQuery } from "@tanstack/react-query";
import { allowed } from "@/domain/permissions";
import { INVOICE_STATUS_LABEL } from "@/domain/saas";
import { PLAN_LABEL, PLAN_QUOTAS, QUOTA_LABEL, STATUS_LABEL, UNLIMITED } from "@/domain/tenancy";
import { formatBRL } from "@/lib/money";
import { tenantRepo } from "@/services/mock/tenant-repo";

type Theme = "dark" | "light" | "system";
const TABS = [["aparencia", "Aparência"], ["escritorio", "Escritório"], ["assinatura", "Assinatura LexSion"], ["calendario", "Feriados e calendário"], ["notificacoes", "Notificações"], ["dados", "Dados e LGPD"], ["dispositivo", "Dispositivo"]] as const;
type Tab = (typeof TABS)[number][0];

function applyTheme(t: Theme) {
  try {
    localStorage.setItem("siwiltec.theme", t);
  } catch {}
  const resolved = t === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : t;
  document.documentElement.dataset.theme = resolved;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", resolved === "light" ? "#FCFAF6" : "#090A0D"));
}

export default function ConfiguracoesPage() {
  const url = useUrlState();
  const tab = (url.get("aba") as Tab) ?? "aparencia";
  const settings = useCollection("settings");
  const s = settings.data?.[0];
  const { user } = useSession();
  const seesBilling = allowed(user?.role, "gerir_equipe");
  const tabs = TABS.filter(([k]) => k !== "assinatura" || seesBilling);
  return (
    <Guard area="configuracoes">
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title="Configurações" description="Escritório, calendário, notificações, dados e aparência." />
        <div role="tablist" aria-label="Configurações" className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => url.set("aba", k === "aparencia" ? null : k)} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${tab === k ? "border-brand bg-selection" : "border-line text-fg-muted"}`}>{l}</button>)}
        </div>
        {tab === "aparencia" && <Appearance />}
        {tab === "escritorio" && s && <Office key={s.id} s={s} />}
        {tab === "assinatura" && seesBilling && <Subscription />}
        {tab === "calendario" && s && <CalendarSettings key={s.calendarVersion + s.holidays.length} s={s} />}
        {tab === "notificacoes" && s && <Notifications key={s.id} s={s} />}
        {tab === "dados" && s && <DataLgpd s={s} />}
        {tab === "dispositivo" && <Device />}
      </div>
    </Guard>
  );
}

function Appearance() {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferência local
      setTheme((localStorage.getItem("siwiltec.theme") as Theme) ?? "dark");
    } catch {}
  }, []);
  return (
    <>
      <section className="panel p-5" aria-labelledby="ap-t">
        <h2 id="ap-t" className="mb-3 font-semibold">Tema</h2>
        <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
          {([["dark", "Escuro", Moon], ["light", "Claro", Sun], ["system", "Sistema", Monitor]] as const).map(([k, label, Icon]) => (
            <button key={k} role="radio" aria-checked={theme === k} onClick={() => { setTheme(k); applyTheme(k); }} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] border text-sm ${theme === k ? "border-brand bg-selection" : "border-line hover:border-line-strong"}`}><Icon aria-hidden className="size-5" /> {label}</button>
          ))}
        </div>
      </section>
      <section className="panel space-y-3 p-5 text-sm">
        <h2 className="font-semibold">Identidade visual do escritório</h2>
        <p className="text-fg-muted">Logotipo, cores, densidade, tamanho do texto, linguagem simples e o aplicativo do escritório (com QR Code de instalação).</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/configuracoes/branding" className="btn btn-secondary w-fit"><Palette aria-hidden className="size-4" /> Abrir Identidade visual e Meu aplicativo</Link>
          <Link href="/app/configuracoes/emails" className="btn btn-ghost w-fit">Modelos de e-mail</Link>
        </div>
      </section>
    </>
  );
}

function Office({ s }: { s: OrgSettings }) {
  const act = useAction("settings");
  const [hours, setHours] = useState(s.hours);
  const [areas, setAreas] = useState(s.areas);
  const [cats, setCats] = useState(s.financeCategories.join("\n"));
  return (
    <section className="panel space-y-4 p-5 text-sm">
      <label className="block"><span className="label">Horário de atendimento</span><input className="field" value={hours} onChange={(e) => setHours(e.target.value)} /></label>
      <label className="block"><span className="label">Fuso horário</span><input className="field" value={s.timezone} readOnly /></label>
      <fieldset><legend className="label">Áreas de atuação</legend><div className="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3">{ALL_AREAS.map((a) => <label key={a} className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={areas.includes(a)} onChange={(e) => setAreas(e.target.checked ? [...areas, a] : areas.filter((x) => x !== a))} />{a}</label>)}</div><p className="mt-1 text-xs text-fg-muted">Ter a área no catálogo não significa motor jurídico validado.</p></fieldset>
      <label className="block"><span className="label">Categorias financeiras (uma por linha)</span><textarea rows={5} className="field py-2" value={cats} onChange={(e) => setCats(e.target.value)} /></label>
      <Feedback error={act.error} notice={act.notice} />
      <button className="btn btn-primary" onClick={() => act.run((ctx) => updateRow("settings", s.id, ctx, (x: OrgSettings) => ({ ...x, hours, areas, financeCategories: cats.split("\n").map((c) => c.trim()).filter(Boolean) }), "Configurações do escritório"), "Configurações salvas.")}>Salvar</button>
    </section>
  );
}

// Somente leitura: o escritório vê o próprio plano, consumo e faturas da assinatura. Alterações ficam com a plataforma.
function Subscription() {
  const { org, tenant } = useSession();
  const q = useQuery({
    queryKey: ["minha-assinatura", org?.id],
    enabled: !!org,
    queryFn: async () => ({ usage: await tenantRepo.getUsage(org!.id), invoices: (await readAll("saasInvoices")).filter((i) => i.organizationId === org!.id).sort((a, b) => b.due.localeCompare(a.due)) }),
  });
  if (!tenant) return <p className="text-sm text-fg-muted">Assinatura indisponível para este escritório na demonstração.</p>;
  const quotas = PLAN_QUOTAS[tenant.plan];
  return (
    <section className="space-y-4 text-sm" data-testid="minha-assinatura">
      <div className="panel space-y-2 p-5">
        <h2 className="font-semibold">Plano {PLAN_LABEL[tenant.plan]} · {tenant.cycle}</h2>
        <p>Situação: <Badge tone={tenant.status === "ativa" ? "success" : tenant.status === "trial" ? "info" : "warning"}>{STATUS_LABEL[tenant.status]}</Badge>{tenant.status === "trial" && tenant.trialEndsAt ? ` · teste até ${formatInstant(tenant.trialEndsAt).split(" ")[0]}` : ""}</p>
        <p className="text-fg-muted">Para mudar de plano, fale com o suporte LexSion. Valores desta demonstração são fictícios; nada é cobrado.</p>
      </div>
      {q.data && (
        <div className="panel p-5">
          <h2 className="mb-3 font-semibold">Consumo do plano</h2>
          <ul className="space-y-2">
            {(Object.keys(QUOTA_LABEL) as (keyof typeof QUOTA_LABEL)[]).map((k) => {
              const used = q.data.usage[k], max = quotas[k];
              return <li key={k} className="flex justify-between gap-3"><span>{QUOTA_LABEL[k]}</span><span className="num">{used} de {max === UNLIMITED ? "ilimitado" : max}</span></li>;
            })}
          </ul>
        </div>
      )}
      <div className="panel overflow-x-auto p-5">
        <h2 className="mb-3 font-semibold">Faturas da assinatura</h2>
        {q.data && q.data.invoices.length === 0 && <p className="text-fg-muted">Nenhuma fatura até agora.</p>}
        {!!q.data?.invoices.length && (
          <table className="w-full min-w-[480px]">
            <caption className="sr-only">Faturas da assinatura LexSion</caption>
            <thead><tr className="text-left text-xs text-fg-muted"><th className="py-1">Período</th><th>Vencimento</th><th>Valor</th><th>Situação</th></tr></thead>
            <tbody>{q.data.invoices.map((i) => <tr key={i.id} className="border-t border-line"><td className="num py-2">{formatCivil(i.periodStart)} – {formatCivil(i.periodEnd)}</td><td className="num">{formatCivil(i.due)}</td><td className="num">{formatBRL(i.amount)}</td><td>{INVOICE_STATUS_LABEL[i.status]}</td></tr>)}</tbody>
          </table>
        )}
        <p className="mt-3 text-xs text-fg-muted">Separado dos honorários que o escritório cobra dos clientes.</p>
      </div>
    </section>
  );
}

function CalendarSettings({ s }: { s: OrgSettings }) {
  const act = useAction("settings");
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const bump = (v: string) => v.replace(/(\d+)(-demo)?$/, (_, n, d) => `${Number(n) + 1}${d ?? ""}`);
  return (
    <section className="panel space-y-3 p-5 text-sm">
      <p>Versão do calendário: <Badge icon={false}>{s.calendarVersion}</Badge> — cada alteração gera nova versão; prazos registram a versão usada na contagem.</p>
      <ul className="divide-y divide-line rounded border border-line">{[...s.holidays].sort((a, b) => a.date.localeCompare(b.date)).map((h) => <li key={h.date} className="flex justify-between p-2"><span className="num">{formatCivil(h.date)}</span><span className="flex-1 px-3">{h.name}</span><span className="text-fg-muted">{h.scope}</span></li>)}</ul>
      <div className="flex flex-wrap gap-2"><input type="date" aria-label="Data do feriado" className="field w-auto" value={date} onChange={(e) => setDate(e.target.value)} /><input className="field max-w-xs" aria-label="Nome do feriado" placeholder="Nome / suspensão" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-secondary" disabled={!date || !name.trim()} onClick={() => act.run((ctx) => updateRow("settings", s.id, ctx, (x: OrgSettings) => ({ ...x, holidays: [...x.holidays.filter((h) => h.date !== date), { date, name: name.trim(), scope: "Local" }], calendarVersion: bump(x.calendarVersion) }), "Feriado adicionado"), "Feriado adicionado; nova versão do calendário.")}>Adicionar</button></div>
      <Feedback error={act.error} notice={act.notice} />
    </section>
  );
}

function Notifications({ s }: { s: OrgSettings }) {
  const act = useAction("settings");
  const [prefs, setPrefs] = useState(s.notificationPrefs);
  const [perm, setPerm] = useState<string>("—");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura de capacidade do navegador
    setPerm(typeof Notification === "undefined" ? "não suportado" : Notification.permission);
  }, []);
  return (
    <section className="panel space-y-4 p-5 text-sm">
      <table className="w-full"><caption className="sr-only">Preferências por evento e canal</caption>
        <thead><tr className="text-left text-xs text-fg-muted"><th className="py-1">Evento</th><th>No app</th><th>E-mail (simulado)</th><th>WhatsApp (simulado)</th></tr></thead>
        <tbody>{Object.entries(prefs).map(([ev, p]) => <tr key={ev} className="border-t border-line"><th scope="row" className="py-2 text-left font-normal">{ev}</th>{(["app", "email", "whatsapp"] as const).map((ch) => <td key={ch}><input type="checkbox" aria-label={`${ev} por ${ch}`} className="size-4 accent-[var(--brand)]" checked={p[ch]} onChange={(e) => setPrefs({ ...prefs, [ev]: { ...p, [ch]: e.target.checked } })} /></td>)}</tr>)}</tbody>
      </table>
      <button className="btn btn-primary" onClick={() => act.run((ctx) => updateRow("settings", s.id, ctx, (x: OrgSettings) => ({ ...x, notificationPrefs: prefs }), "Notificações"), "Preferências salvas.")}>Salvar preferências</button>
      <div className="rounded border border-line p-3">
        <p className="font-medium">Notificações no aparelho (push)</p>
        <p className="text-fg-muted">Push remoto depende do backend (fase futura). Aqui só pedimos permissão se você quiser — nunca automaticamente. Alertas de prazo não dependem de push. Situação: <strong>{perm}</strong>.</p>
        {perm === "default" && <button className="btn btn-secondary mt-2" onClick={async () => setPerm(await Notification.requestPermission())}>Permitir notificações neste aparelho</button>}
        {perm === "denied" && <p className="mt-1 text-warning">Permissão negada. Você pode reativar nas configurações do navegador; o app continua funcionando sem push.</p>}
      </div>
      <Feedback error={act.error} notice={act.notice} />
    </section>
  );
}

function DataLgpd({ s }: { s: OrgSettings }) {
  const { org, restoreTenant } = useSession();
  const act = useAction("settings");
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const [subject, setSubject] = useState("");
  const exportAll = async () => {
    const names = ["clients", "cases", "leads", "documents", "installments", "payments", "tasks", "events"] as const;
    const out: Record<string, unknown[]> = {};
    for (const n of names) out[n] = (await readAll(n)).filter((r) => (r as { organizationId?: string }).organizationId === org?.id).map((r) => ("blob" in (r as object) ? { ...(r as object), blob: undefined } : r));
    downloadText(`exportacao-demo-${org?.id}.json`, JSON.stringify({ aviso: "Dados fictícios de demonstração", geradoEm: new Date().toISOString(), ...out }, null, 2), "application/json");
  };
  return (
    <>
      <section className="panel space-y-3 p-5 text-sm">
        <h2 className="font-semibold">LGPD e retenção</h2>
        <p>Retenção configurada: <strong>{s.retentionYears} anos</strong>. Pedidos de eliminação passam por revisão de retenção — não há promessa de exclusão imediata de todo registro (obrigações legais e sigilo profissional).</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary" onClick={exportAll}><Download aria-hidden className="size-4" /> Exportar dados do escritório (JSON)</button>
        </div>
        <div className="flex flex-wrap gap-2"><input className="field max-w-xs" aria-label="Titular" placeholder="Titular (nome)" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <button className="btn btn-ghost" disabled={!subject.trim()} onClick={async () => { if (await act.run((ctx) => updateRow("settings", s.id, ctx, (x: OrgSettings) => ({ ...x, dataRequests: [...x.dataRequests, { id: crypto.randomUUID().slice(0, 6), at: new Date().toISOString(), kind: "eliminacao", subject: subject.trim(), status: "em_revisao", note: "Aguardando revisão de retenção" }] }), "Pedido de eliminação"), "Pedido registrado para revisão.")) setSubject(""); }}>Registrar pedido de eliminação</button>
        </div>
        {s.dataRequests.length > 0 && <ul className="space-y-1">{s.dataRequests.map((r) => <li key={r.id}>{formatInstant(r.at)} · {r.kind} · {r.subject} · <Badge tone="warning">{r.status === "em_revisao" ? "Em revisão" : "Concluída"}</Badge></li>)}</ul>}
        <Feedback error={act.error} notice={act.notice} />
      </section>
      <section className="panel p-5">
        <h2 className="mb-1 font-semibold">Restaurar demonstração</h2>
        <p className="mb-3 text-sm text-fg-muted">Recarrega os dados fictícios iniciais <strong>somente de {org?.name}</strong> neste navegador. Outros escritórios, a identidade visual e o progresso de treinamento não são alterados. Sair do sistema nunca apaga dados.</p>
        <button className="btn btn-danger" onClick={() => setConfirm(true)}><RotateCcw aria-hidden className="size-4" /> Restaurar demonstração</button>
        {done && <p role="status" className="mt-2 text-sm text-success">Demonstração restaurada.</p>}
      </section>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Restaurar demonstração?">
        <p>Os cadastros, pagamentos, mensagens e arquivos criados em <strong>{org?.name}</strong> nesta demonstração serão descartados neste navegador. Isso não pode ser desfeito. Exporte antes, se quiser guardar.</p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="btn btn-ghost" autoFocus onClick={() => setConfirm(false)}>Cancelar</button>
          <button className="btn btn-secondary" onClick={exportAll}><Download aria-hidden className="size-4" /> Exportar antes</button>
          <button className="btn btn-danger" onClick={async () => { await restoreTenant(); setConfirm(false); setDone(true); }}>Restaurar agora</button>
        </div>
      </Dialog>
    </>
  );
}

function Device() {
  const [usage, setUsage] = useState<string | null>(null);
  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setUsage(`${((e.usage ?? 0) / 1024 / 1024).toFixed(1)} MB usados neste dispositivo`)).catch(() => {});
  }, []);
  return (
    <section className="space-y-3">
      <InstallCard force />
      <p className="flex items-center gap-2 text-sm text-fg-muted"><HardDrive aria-hidden className="size-4" />{storageMode() === "memory" ? "Armazenamento local indisponível: dados só em memória até fechar a aba." : "Dados guardados neste navegador (IndexedDB)."} {usage}</p>
      <button className="btn btn-secondary" onClick={async () => { const ok = await navigator.storage?.persist?.(); setUsage(ok ? "Armazenamento persistente concedido pelo navegador." : "O navegador não garantiu persistência; dados podem ser removidos se faltar espaço."); }}>Pedir armazenamento persistente</button>
    </section>
  );
}
