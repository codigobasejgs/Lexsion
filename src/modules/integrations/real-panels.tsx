"use client";

import { useEffect, useState } from "react";
import { QrCode, RefreshCw, Sparkles, Unplug } from "lucide-react";
import { useSession } from "@/components/providers";
import { supabaseBrowser } from "@/lib/supabase/browser";

type R<T> = { ok: boolean; data?: T; error?: { message: string } };
const post = async <T,>(url: string, body: object): Promise<R<T>> =>
  (await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null)) ?? { ok: false, error: { message: "Sem conexão." } };

/** Integrações em auditoria (servidor decide): mostra o aviso e não oferece a ação. */
export function useGate(key: "ai" | "whatsapp") {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => { void fetch("/api/integracoes/estado").then((r) => r.json()).then((j) => setOn(!!j?.[key])).catch(() => setOn(false)); }, [key]);
  return on;
}
const GATED = { ai: "Assistente de IA em auditoria: indisponível para dados de clientes até a conclusão da revisão dos termos e do tratamento de dados.", whatsapp: "WhatsApp em auditoria: indisponível para dados de clientes até a confirmação do operador e da infraestrutura do provedor." };
export function GatedNotice({ k }: { k: "ai" | "whatsapp" }) {
  return <p role="status" className="panel border-warning/40 bg-warning-bg p-4 text-sm text-warning" data-testid={`integracao-em-auditoria-${k}`}>{GATED[k]}</p>;
}

/** WhatsApp REAL do escritório: QR para parear o aparelho do escritório, estado ao vivo, desconectar. Só o titular conecta. */
export function WhatsAppReal() {
  const gate = useGate("whatsapp");
  return gate === null ? null : gate ? <WhatsAppPanel /> : <GatedNotice k="whatsapp" />;
}
function WhatsAppPanel() {
  const { ctx, user } = useSession();
  const [status, setStatus] = useState<string>("…");
  const [qr, setQr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [age, setAge] = useState(0); // segundos desde o último QR recebido
  const isOwner = user?.role === "admin";
  const waiting = !!qr;
  const refresh = async () => {
    if (!ctx) return;
    const r = await post<{ status: string }>("/api/whatsapp", { organizationId: ctx.organizationId, action: "status" });
    setStatus(r.ok ? r.data!.status : "erro");
    if (r.ok && r.data!.status === "operacional") { setQr(null); setMsg("WhatsApp conectado. As conversas novas aparecem em Conversas."); }
    // O celular recusou a leitura (QR vencido, limite de aparelhos) e o servidor encerrou a tentativa.
    if (r.ok && r.data!.status === "desconectado" && qr) { setQr(null); setMsg("O celular não concluiu a conexão e a tentativa foi encerrada. Toque em “Gerar QR” e leia o código novo logo em seguida."); }
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- estado lido do servidor ao abrir
    refresh();
    const t = setInterval(refresh, waiting ? 4000 : 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh depende só do escritório
  }, [ctx?.organizationId, waiting]);
  // O WhatsApp troca o QR a cada ~20 s; um QR velho dá erro no celular. Enquanto espera, busca o atual a cada 15 s.
  useEffect(() => {
    if (!qr || !ctx) return;
    const tick = setInterval(() => setAge((a) => a + 1), 1000);
    const renew = setInterval(async () => {
      const r = await post<{ status: string; qr?: string | null }>("/api/whatsapp", { organizationId: ctx.organizationId, action: "qr" });
      if (r.ok && r.data!.qr) { setQr(r.data!.qr); setAge(0); }
      else if (!r.ok) { setQr(null); setMsg(r.error?.message ?? "A conexão expirou. Toque em “Gerar QR” de novo."); }
    }, 15000);
    return () => { clearInterval(tick); clearInterval(renew); };
  }, [qr === null, ctx?.organizationId]); // eslint-disable-line react-hooks/exhaustive-deps -- reinicia só ao abrir/fechar o QR
  const act = async (action: "connect" | "disconnect") => {
    if (!ctx) return;
    setBusy(true);
    setMsg(null);
    const r = await post<{ status: string; qr?: string | null }>("/api/whatsapp", { organizationId: ctx.organizationId, action });
    setBusy(false);
    if (!r.ok) return setMsg(r.error?.message ?? "Falhou.");
    setStatus(r.data!.status);
    setQr(r.data!.qr ?? null);
    setAge(0);
    if (action === "connect" && !r.data!.qr) setMsg("Instância criada. Se o QR não aparecer, toque em “Gerar QR” de novo em alguns segundos.");
  };
  const label = { operacional: "Conectado", conectando: "Aguardando leitura do QR", desconectado: "Desconectado", erro: "Erro de comunicação", "…": "Verificando…" }[status] ?? status;
  return (
    <section className="panel space-y-3 p-4 text-sm" aria-labelledby="wa-h">
      <div className="flex flex-wrap items-center gap-2"><h2 id="wa-h" className="flex-1 font-semibold">WhatsApp do escritório</h2><span role="status" className={status === "operacional" ? "text-success" : "text-fg-muted"}>{label}</span><button className="btn btn-ghost min-h-9 px-2" aria-label="Atualizar estado" onClick={refresh}><RefreshCw aria-hidden className="size-4" /></button></div>
      <p className="text-fg-muted">No celular do escritório: WhatsApp → Configurações → Aparelhos conectados → Conectar um aparelho → aponte a câmera para o QR. As mensagens recebidas entram em Conversas; as respostas saem por este número. Nenhum envio em massa.</p>
      {qr && (
        <div className="space-y-1">
          <img src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`} alt="QR para conectar o WhatsApp do escritório" className="size-60 rounded bg-white p-2" />
          <p className="text-xs text-fg-muted" aria-live="polite">O código muda sozinho a cada poucos segundos (atualizado há {age} s). Leia o que estiver na tela agora.</p>
        </div>
      )}
      {isOwner ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {status !== "operacional" && <button className="btn btn-primary min-h-9" disabled={busy} onClick={() => act("connect")}><QrCode aria-hidden className="size-4" /> {busy ? "Gerando…" : qr ? "Gerar novo QR" : "Gerar QR"}</button>}
            {status === "operacional" && <button className="btn btn-danger min-h-9" disabled={busy} onClick={() => act("disconnect")}><Unplug aria-hidden className="size-4" /> Desconectar</button>}
          </div>
          {status !== "operacional" && (
            <details className="rounded border border-line p-3">
              <summary className="cursor-pointer font-medium">O celular mostrou “Algo deu errado” ou o QR não lê?</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-fg-muted">
                <li>O QR expira em segundos. Toque em “Gerar novo QR” e leia logo em seguida, sem fechar esta tela.</li>
                <li>No celular, apague aparelhos conectados antigos sem uso (o limite é 4) e confira se o WhatsApp está atualizado e com internet.</li>
                <li>Se aparecer “redefinir o aparelho”, não redefina: feche o leitor, toque em “Gerar novo QR” aqui e leia de novo.</li>
              </ul>
            </details>
          )}
        </div>
      ) : <p className="text-xs text-fg-muted">Somente o titular conecta ou desconecta o número.</p>}
      {msg && <p role="alert" className="text-xs">{msg}</p>}
    </section>
  );
}

/** Consentimento do titular para usar IA externa (Google Gemini) com dados do escritório. Registrado e auditado no banco. */
export function AiConsent() {
  const gate = useGate("ai");
  return gate === null ? null : gate ? <AiConsentPanel /> : <GatedNotice k="ai" />;
}
function AiConsentPanel() {
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
  const gate = useGate("ai");
  return gate ? <AiAssistantPanel /> : null;
}
function AiAssistantPanel() {
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
