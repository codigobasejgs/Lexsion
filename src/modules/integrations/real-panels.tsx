"use client";

import { useEffect, useState } from "react";
import { QrCode, RefreshCw, Sparkles, Unplug } from "lucide-react";
import { useSession } from "@/components/providers";
import { supabaseBrowser } from "@/lib/supabase/browser";

type R<T> = { ok: boolean; data?: T; error?: { message: string } };
const post = async <T,>(url: string, body: object): Promise<R<T>> =>
  (await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null)) ?? { ok: false, error: { message: "Sem conexão." } };

/** WhatsApp REAL do escritório: QR para parear o aparelho do escritório, estado ao vivo, desconectar. Só o titular conecta. */
export function WhatsAppReal() {
  const { ctx, user } = useSession();
  const [status, setStatus] = useState<string>("…");
  const [qr, setQr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isOwner = user?.role === "admin";
  const refresh = async () => {
    if (!ctx) return;
    const r = await post<{ status: string }>("/api/whatsapp", { organizationId: ctx.organizationId, action: "status" });
    setStatus(r.ok ? r.data!.status : "erro");
    if (r.ok && r.data!.status === "operacional") setQr(null);
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- estado lido do servidor ao abrir
    refresh();
    const t = setInterval(refresh, qr ? 5000 : 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh depende só do escritório
  }, [ctx?.organizationId, qr]);
  const act = async (action: "connect" | "disconnect") => {
    if (!ctx) return;
    setBusy(true);
    setMsg(null);
    const r = await post<{ status: string; qr?: string | null }>("/api/whatsapp", { organizationId: ctx.organizationId, action });
    setBusy(false);
    if (!r.ok) return setMsg(r.error?.message ?? "Falhou.");
    setStatus(r.data!.status);
    setQr(r.data!.qr ?? null);
    if (action === "connect" && !r.data!.qr) setMsg("Instância criada. Se o QR não aparecer, toque em “Gerar QR” de novo em alguns segundos.");
  };
  const label = { operacional: "Conectado", conectando: "Aguardando leitura do QR", desconectado: "Desconectado", erro: "Erro de comunicação", "…": "Verificando…" }[status] ?? status;
  return (
    <section className="panel space-y-3 p-4 text-sm" aria-labelledby="wa-h">
      <div className="flex flex-wrap items-center gap-2"><h2 id="wa-h" className="flex-1 font-semibold">WhatsApp do escritório</h2><span role="status" className={status === "operacional" ? "text-success" : "text-fg-muted"}>{label}</span><button className="btn btn-ghost min-h-9 px-2" aria-label="Atualizar estado" onClick={refresh}><RefreshCw aria-hidden className="size-4" /></button></div>
      <p className="text-fg-muted">Conecte o número do escritório lendo o QR no aparelho (WhatsApp → Aparelhos conectados). As mensagens recebidas entram em Conversas; as respostas da equipe saem por este número. Nenhum envio em massa.</p>
      {qr && <img src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`} alt="QR para conectar o WhatsApp do escritório" className="size-56 rounded bg-white p-2" />}
      {isOwner ? (
        <div className="flex flex-wrap gap-2">
          {status !== "operacional" && <button className="btn btn-primary min-h-9" disabled={busy} onClick={() => act("connect")}><QrCode aria-hidden className="size-4" /> {busy ? "Gerando…" : "Gerar QR"}</button>}
          {status === "operacional" && <button className="btn btn-danger min-h-9" disabled={busy} onClick={() => act("disconnect")}><Unplug aria-hidden className="size-4" /> Desconectar</button>}
        </div>
      ) : <p className="text-xs text-fg-muted">Somente o titular conecta ou desconecta o número.</p>}
      {msg && <p role="alert" className="text-xs">{msg}</p>}
    </section>
  );
}

/** Consentimento do titular para usar IA externa (Google Gemini) com dados do escritório. Registrado e auditado no banco. */
export function AiConsent() {
  const { ctx, user } = useSession();
  const [on, setOn] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!ctx) return;
    (async () => {
      const { data } = await supabaseBrowser().from("organizations").select("ai_enabled_at").eq("id", ctx.organizationId).maybeSingle();
      setOn(!!(data as { ai_enabled_at?: string | null } | null)?.ai_enabled_at);
    })();
  }, [ctx]);
  const toggle = async () => {
    if (!ctx) return;
    setErr(null);
    const { error } = await supabaseBrowser().rpc("set_ai_enabled", { p_org: ctx.organizationId, p_enabled: !on });
    if (error) return setErr(error.message);
    setOn(!on);
  };
  return (
    <section className="panel space-y-2 p-4 text-sm" aria-labelledby="ai-h">
      <h2 id="ai-h" className="flex items-center gap-2 font-semibold"><Sparkles aria-hidden className="size-4" /> Assistente de IA</h2>
      <p className="text-fg-muted">Usa o Google Gemini pelo servidor da LexSion. Só o texto que você escolher é enviado; o uso fica registrado sem conteúdo. Toda resposta é sugestão e precisa de revisão profissional. Habilitar é decisão do titular (LGPD).</p>
      <p role="status">{on === null ? "Verificando…" : on ? "Habilitada para este escritório." : "Desabilitada."}</p>
      {user?.role === "admin" && on !== null && <button className={on ? "btn btn-ghost min-h-9" : "btn btn-primary min-h-9"} onClick={toggle}>{on ? "Desabilitar IA" : "Habilitar IA"}</button>}
      {err && <p role="alert" className="text-xs text-danger">{err}</p>}
    </section>
  );
}

/** Assistente REAL: escolhe a finalidade, cola o texto, recebe sugestão marcada para revisão. */
export function AiAssistant() {
  const { ctx } = useSession();
  const [purpose, setPurpose] = useState<"resumo" | "resposta" | "minuta" | "triagem">("resumo");
  const [text, setText] = useState("");
  const [out, setOut] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!ctx) return;
    setBusy(true);
    setErr(null);
    const r = await post<{ text: string }>("/api/ia", { organizationId: ctx.organizationId, purpose, context: text });
    setBusy(false);
    if (r.ok) setOut(r.data!.text);
    else setErr(r.error?.message ?? "A IA não respondeu.");
  };
  return (
    <section className="panel space-y-3 p-4 text-sm">
      <label className="block"><span className="label">Finalidade</span><select className="field" value={purpose} onChange={(e) => setPurpose(e.target.value as typeof purpose)}><option value="resumo">Resumir</option><option value="resposta">Responder ao cliente</option><option value="triagem">Triagem: o que falta</option><option value="minuta">Rascunho de peça</option></select></label>
      <label className="block"><span className="label">Texto (até 12.000 caracteres)</span><textarea rows={8} className="field py-2" maxLength={12000} value={text} onChange={(e) => setText(e.target.value)} /></label>
      <button className="btn btn-primary" disabled={busy || text.trim().length < 10} onClick={run}><Sparkles aria-hidden className="size-4" /> {busy ? "Gerando…" : "Gerar sugestão"}</button>
      {err && <p role="alert" className="text-danger">{err}</p>}
      {out && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-warning">Sugestão da IA — revise antes de usar</p>
          <pre className="whitespace-pre-wrap rounded border border-line bg-surface p-3 font-sans">{out}</pre>
          <button className="btn btn-secondary min-h-9" onClick={() => navigator.clipboard?.writeText(out).catch(() => {})}>Copiar</button>
        </div>
      )}
    </section>
  );
}
