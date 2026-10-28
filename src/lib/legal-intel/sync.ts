import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { classifyAreas } from "./classify";
import { discoverUpdates, fetchDocument, type NormalizedDoc } from "./camara";

// Motor de sincronização de UMA fonte. Idempotente: (fonte, id oficial) + hash do conteúdo.
// Novo documento ⇒ versão 1 + atualização "novo"; conteúdo mudou ⇒ nova versão + "alteracao"; igual ⇒ só confirma.
// Trava por fonte, circuit breaker após falhas seguidas, cursor de período, registro de cada execução.
const PROVIDER = "camara-proposicoes";
const MAX_FAILS = 3;

const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);

export async function syncCamara(trigger: "cron" | "manual" | "teste", opts: { maxItems?: number } = {}) {
  const db = supabaseAdmin();
  const { data: prov } = await db.from("legal_source_providers").select("*").eq("id", PROVIDER).single();
  if (!prov?.enabled) return { status: "bloqueado" as const, reason: "fonte desabilitada" };
  if (prov.circuit_open_until && new Date(prov.circuit_open_until) > new Date() && trigger === "cron") return { status: "ignorado" as const, reason: "circuit breaker aberto" };
  const { data: locked } = await db.rpc("acquire_sync_lock", { p_provider: PROVIDER, p_seconds: 240 });
  if (!locked) return { status: "ignorado" as const, reason: "outra execução em andamento" };

  const t0 = Date.now();
  const { data: run } = await db.from("source_sync_runs").insert({ provider_id: PROVIDER, trigger }).select("id").single();
  const stats = { seen: 0, novo: 0, changed: 0, alerts: 0 };
  try {
    const { data: cur } = await db.from("source_sync_cursors").select("cursor").eq("provider_id", PROVIDER).maybeSingle();
    // Janela: desde o último dia confirmado (com 1 dia de folga para tramitação retroativa) até hoje.
    const last = (cur?.cursor as { lastDay?: string } | undefined)?.lastDay;
    const today = ymd(new Date());
    const from = last ? ymd(new Date(new Date(`${last}T12:00:00-03:00`).getTime() - 86_400_000)) : ymd(new Date(Date.now() - 86_400_000));
    const ids = await discoverUpdates(from, today, opts.maxItems ?? 150);
    const errors: string[] = [];
    for (const id of ids) {
      if (Date.now() - t0 > 200_000) { errors.push("tempo limite da execução; restante fica para a próxima"); break; }
      let doc: NormalizedDoc;
      try { doc = await fetchDocument(id); } catch (e) { errors.push(`${id}: ${(e as Error).message}`); continue; }
      stats.seen++;
      const r = await upsertDoc(doc);
      if (r === "novo") stats.novo++;
      if (r === "alteracao") stats.changed++;
    }
    stats.alerts = await createAlerts(run!.id);
    await db.from("source_sync_cursors").upsert({ provider_id: PROVIDER, cursor: { lastDay: today, lastIds: ids.length }, updated_at: new Date().toISOString() });
    const status = errors.length && !stats.seen ? "erro" : errors.length ? "parcial" : "ok";
    await db.from("source_sync_runs").update({ finished_at: new Date().toISOString(), status, items_seen: stats.seen, items_new: stats.novo, items_changed: stats.changed, alerts_created: stats.alerts, latency_ms: Date.now() - t0, error: errors.slice(0, 5).join(" | ") || null }).eq("id", run!.id);
    const now = new Date();
    await db.from("legal_source_providers").update({
      last_run_at: now.toISOString(), last_success_at: status !== "erro" ? now.toISOString() : prov.last_success_at, last_error: status === "erro" ? errors[0] : null,
      consecutive_failures: status === "erro" ? prov.consecutive_failures + 1 : 0, circuit_open_until: null, sync_lock_until: null,
      next_run_at: new Date(now.getTime() + prov.frequency_minutes * 60_000).toISOString(), updated_at: now.toISOString(),
    }).eq("id", PROVIDER);
    return { status, ...stats, window: { from, to: today }, runId: run!.id };
  } catch (e) {
    const fails = prov.consecutive_failures + 1;
    const msg = (e as Error).message.slice(0, 300);
    await db.from("source_sync_runs").update({ finished_at: new Date().toISOString(), status: "erro", latency_ms: Date.now() - t0, error: msg }).eq("id", run!.id);
    // Falha: o último dado íntegro continua; só o painel mostra "fonte indisponível".
    await db.from("legal_source_providers").update({ last_run_at: new Date().toISOString(), last_error: msg, consecutive_failures: fails, sync_lock_until: null,
      circuit_open_until: fails >= MAX_FAILS ? new Date(Date.now() + 3_600_000).toISOString() : null, updated_at: new Date().toISOString() }).eq("id", PROVIDER);
    return { status: "erro" as const, error: msg, runId: run!.id };
  }
}

async function upsertDoc(d: NormalizedDoc): Promise<"novo" | "alteracao" | "igual"> {
  const db = supabaseAdmin();
  const areas = classifyAreas(`${d.ementa} ${d.title}`);
  const { data: ex } = await db.from("legal_documents").select("id,content_hash,current_version").eq("provider_id", PROVIDER).eq("external_id", d.externalId).maybeSingle();
  const now = new Date().toISOString();
  if (ex && ex.content_hash === d.contentHash) {
    await db.from("legal_documents").update({ last_confirmed_at: now }).eq("id", ex.id);
    return "igual";
  }
  const fields = { doc_kind: d.docKind, type_code: d.typeCode, number: d.number, title: d.title, ementa: d.ementa, organ: d.organ, status_label: d.statusLabel, official_url: d.officialUrl, published_on: d.publishedOn, last_event_at: d.lastEventAt, content_hash: d.contentHash, areas, last_confirmed_at: now, fetched_at: now };
  let docId: string, version: number;
  if (!ex) {
    const { data, error } = await db.from("legal_documents").insert({ provider_id: PROVIDER, external_id: d.externalId, current_version: 1, ...fields }).select("id").single();
    if (error) { if (error.code === "23505") return "igual"; throw new Error(error.message); }
    docId = data.id; version = 1;
  } else {
    docId = ex.id; version = ex.current_version + 1;
    await db.from("legal_documents").update({ ...fields, current_version: version }).eq("id", docId);
  }
  const { data: v, error: ve } = await db.from("legal_document_versions").insert({ document_id: docId, version, content_hash: d.contentHash, ementa: d.ementa, status_label: d.statusLabel, last_event: d.lastEvent, last_event_at: d.lastEventAt, raw: d.raw }).select("id").single();
  if (ve) return "igual"; // mesmo hash já registrado (corrida): não duplica
  await db.from("legal_updates").insert({ document_id: docId, version_id: v.id, update_type: ex ? "alteracao" : "novo", areas });
  return ex ? "alteracao" : "novo";
}

/** Alerta por escritório: área ou palavra-chave das preferências. Único por (escritório, atualização). */
async function createAlerts(runId: number): Promise<number> {
  const db = supabaseAdmin();
  const { data: run } = await db.from("source_sync_runs").select("started_at").eq("id", runId).single();
  const [{ data: prefs }, { data: ups }] = await Promise.all([
    db.from("tenant_legal_preferences").select("organization_id,areas,keywords,include_projects,digest"),
    db.from("legal_updates").select("id,areas,legal_documents(doc_kind,title,ementa)").gte("detected_at", run!.started_at),
  ]);
  let n = 0;
  for (const p of prefs ?? []) {
    if (p.digest === "nenhum") continue;
    for (const u of ups ?? []) {
      const doc = (u as unknown as { legal_documents: { doc_kind: string; title: string; ementa: string } }).legal_documents;
      if (!p.include_projects && (doc.doc_kind === "proposicao" || doc.doc_kind === "medida_provisoria")) continue;
      const area = (u.areas as string[]).find((a) => (p.areas as string[]).includes(a));
      const kw = (p.keywords as string[]).find((k) => k.length >= 3 && `${doc.title} ${doc.ementa}`.toLowerCase().includes(k.toLowerCase()));
      if (!area && !kw) continue;
      const reason = area ? `área ${area}` : `palavra-chave “${kw}”`;
      const { error } = await db.from("tenant_alerts").insert({ organization_id: p.organization_id, update_id: u.id, reason });
      if (error) continue; // já alertado: não duplica notificação
      n++;
      // Notificação in-app (mesma coleção que o sino lê). Texto vem da fonte oficial; nada inventado.
      const nid = `intel-${u.id}`;
      await db.from("org_records").insert({ organization_id: p.organization_id, collection: "notifications", id: nid, data: {
        id: nid, organizationId: p.organization_id, at: new Date().toISOString(), severity: "info", read: false, href: `/app/jornal/${u.id}`,
        text: `${doc.title} (${doc.doc_kind === "proposicao" ? "projeto em tramitação" : doc.doc_kind === "medida_provisoria" ? "medida provisória" : "publicação"}) — ${reason}`,
      } });
    }
  }
  return n;
}
