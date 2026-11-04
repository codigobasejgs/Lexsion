"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, KeyRound } from "lucide-react";
import { useSession } from "@/components/providers";
import { Badge } from "@/components/ui";
import { PROVIDERS, type ProviderSpec } from "@/domain/integrations";
import { formatInstant } from "@/lib/dates";

type Row = { provider: string; hint: string; environment: string; status: "verificada" | "recusada" | "nao_testada" | "nao_verificavel"; last_check_at: string | null; last_error: string | null };
const STATUS = {
  verificada: { label: "Chave verificada", tone: "success" },
  nao_verificavel: { label: "Salva (sem teste disponível)", tone: "info" },
  nao_testada: { label: "Salva, não testada", tone: "warning" },
  recusada: { label: "Recusada pelo provedor", tone: "danger" },
} as const;

/** Chaves do PRÓPRIO escritório: passo a passo para obter, salvar (cifrada no servidor), testar no provedor real. */
export function OfficeKeys() {
  const { ctx } = useSession();
  const q = useQuery({
    queryKey: ["credenciais", ctx?.organizationId],
    enabled: !!ctx,
    queryFn: async () => (await (await fetch(`/api/integracoes/credenciais?org=${ctx!.organizationId}`)).json()) as { ok: boolean; canManage: boolean; items: Row[] },
  });
  return (
    <section className="mt-8 space-y-3" aria-labelledby="chaves-h">
      <div>
        <h2 id="chaves-h" className="text-lg font-semibold">Contas do escritório</h2>
        <p className="text-sm text-fg-muted">Conecte as contas que são do seu escritório. A chave fica cifrada no servidor da LexSion; ninguém da equipe (nem a LexSion pela tela) volta a vê-la. Só o titular configura.</p>
      </div>
      <ul className="grid gap-3 lg:grid-cols-2" data-testid="chaves-escritorio">
        {PROVIDERS.map((p) => <KeyCard key={p.id} p={p} row={q.data?.items.find((r) => r.provider === p.id)} canManage={!!q.data?.canManage} />)}
      </ul>
    </section>
  );
}

function KeyCard({ p, row, canManage }: { p: ProviderSpec; row?: Row; canManage: boolean }) {
  const { ctx } = useSession();
  const qc = useQueryClient();
  const [secret, setSecret] = useState("");
  const [env, setEnv] = useState<"producao" | "teste">((row?.environment as "producao" | "teste") ?? "producao");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const call = async (action: "save" | "test" | "remove") => {
    if (!ctx) return;
    if (action === "remove" && !confirm(`Remover a chave de ${p.name}? As funções que dependem dela param até você cadastrar outra.`)) return;
    setBusy(true); setMsg(null);
    const r = await fetch("/api/integracoes/credenciais", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: ctx.organizationId, provider: p.id, action, secret, environment: env }) }).then((x) => x.json()).catch(() => null) as { ok: boolean; data?: { status: string; detail: string }; error?: { message: string } } | null;
    setBusy(false);
    if (!r?.ok) return setMsg({ ok: false, text: r?.error?.message ?? "Sem conexão. Tente de novo." });
    setSecret("");
    setMsg(action === "remove" ? { ok: true, text: "Chave removida." } : { ok: r.data!.status !== "recusada", text: r.data!.detail });
    await qc.invalidateQueries({ queryKey: ["credenciais", ctx.organizationId] });
    await qc.invalidateQueries({ queryKey: ["integracoes-saude", ctx.organizationId] });
  };
  return (
    <li className="panel flex flex-col gap-3 p-4 text-sm" data-testid={`chave-${p.id}`}>
      <div className="flex items-start gap-2">
        <KeyRound aria-hidden className="mt-0.5 size-4 text-accent" />
        <h3 className="flex-1 font-semibold">{p.name}</h3>
        {row ? <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge> : <Badge tone="neutral">Não conectada</Badge>}
      </div>
      <p className={p.usoAtivo ? "text-fg" : "text-fg-muted"}>{p.uso}</p>
      {row && <p className="text-xs text-fg-muted">Chave {row.hint}{p.environments ? ` · ${row.environment === "teste" ? "teste (sandbox)" : "produção"}` : ""}{row.last_check_at ? ` · testada em ${formatInstant(row.last_check_at)}` : ""}{row.last_error ? ` · ${row.last_error}` : ""}</p>}
      <details>
        <summary className="cursor-pointer font-medium">Como conseguir a chave</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-fg-muted">{p.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        <a className="mt-2 inline-flex items-center gap-1 text-accent underline" href={p.link} target="_blank" rel="noopener noreferrer">Abrir o painel <ExternalLink aria-hidden className="size-3.5" /></a>
      </details>
      {canManage ? (
        <div className="space-y-2 border-t border-line pt-3">
          <label className="block"><span className="label">{row ? `Trocar ${p.field.toLowerCase()}` : p.field}</span><input className="field font-mono" type="password" autoComplete="off" spellCheck={false} placeholder={p.placeholder} value={secret} onChange={(e) => setSecret(e.target.value)} /></label>
          {p.environments && (
            <fieldset className="flex gap-4"><legend className="sr-only">Ambiente</legend>
              {(["producao", "teste"] as const).map((e) => <label key={e} className="flex items-center gap-2"><input type="radio" name={`env-${p.id}`} className="accent-[var(--brand)]" checked={env === e} onChange={() => setEnv(e)} />{e === "producao" ? "Produção" : "Teste (sandbox)"}</label>)}
            </fieldset>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary min-h-9" disabled={busy || secret.trim().length < 3} onClick={() => call("save")}>{busy ? "Testando…" : "Salvar e testar"}</button>
            {row && <button className="btn btn-secondary min-h-9" disabled={busy} onClick={() => call("test")}>Testar de novo</button>}
            {row && <button className="btn btn-ghost min-h-9" disabled={busy} onClick={() => call("remove")}>Remover</button>}
          </div>
        </div>
      ) : <p className="text-xs text-fg-muted">Somente o titular do escritório configura esta conta.</p>}
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-success" : "text-danger"}>{msg.text}</p>}
    </li>
  );
}
