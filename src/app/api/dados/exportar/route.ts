import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/env";
import { zip } from "@/lib/zip";

// Exportação INTEGRAL do escritório (Anexo III.11): só o TITULAR do próprio escritório, conferido pelo banco
// (has_role admin). Gera um ZIP com os dados estruturados (JSON por tabela/coleção), os arquivos privados nas
// extensões originais e um manifesto (SHA-256 de cada arquivo). Nada de outros escritórios, senhas, tokens nem
// segredos (webhook do WhatsApp sai sem o hash). O ZIP fica no bucket privado "exportacoes" e é entregue por URL
// assinada de 10 minutos; pedidos, resultado e downloads ficam registrados. Arquivos com mais de 7 dias são apagados.
export const maxDuration = 60;
const err = (status: number, message: string) => NextResponse.json({ ok: false, error: { message } }, { status });
const MAX_BYTES = 45 * 1024 * 1024; // bucket aceita 50 MB; margem para o JSON e o índice do ZIP
const TABLES: [string, string][] = [["clients", "clientes"], ["cases", "casos"], ["tasks", "tarefas"], ["documents", "documentos_metadados"], ["drafts", "minutas"], ["portal_updates", "atualizacoes_portal"],
  ["tenant_legal_preferences", "preferencias_juridicas"], ["tenant_alerts", "alertas_juridicos"], ["org_role_restrictions", "restricoes_por_papel"], ["org_member_restrictions", "restricoes_por_pessoa"],
  ["client_portal_access", "acessos_portal_cliente"], ["ai_usage", "uso_ia_sem_conteudo"], ["org_practice_profiles", "perfil_de_atuacao"]];

async function owner(req: NextRequest, orgId: string) {
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return { e: err(403, "Origem não permitida.") };
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { e: err(401, "Sessão expirada. Entre novamente.") };
  if (!/^[0-9a-f-]{36}$/.test(orgId)) return { e: err(400, "Escritório inválido.") };
  const { data: ok } = await sb.rpc("has_role", { org: orgId, roles: ["admin"] });
  if (ok !== true) return { e: err(403, "Somente o titular do escritório exporta todos os dados.") };
  return { user: auth.user };
}

export async function POST(req: NextRequest) {
  if (!supabaseConfigured() || !process.env.SUPABASE_SECRET_KEY) return err(503, "Exportação indisponível neste ambiente.");
  const b = (await req.json().catch(() => ({}))) as { organizationId?: string; action?: string; id?: string };
  const orgId = String(b.organizationId ?? "");
  const who = await owner(req, orgId);
  if (who.e) return who.e;
  const db = supabaseAdmin();

  if (b.action === "list") {
    const { data } = await db.from("data_exports").select("id,requested_at,status,bytes,files,records,error,finished_at,downloads").eq("organization_id", orgId).order("requested_at", { ascending: false }).limit(10);
    return NextResponse.json({ ok: true, data: data ?? [] });
  }
  if (b.action === "download") {
    const { data: x } = await db.from("data_exports").select("id,status,storage_path,requested_at,downloads").eq("id", String(b.id ?? "")).eq("organization_id", orgId).maybeSingle();
    if (!x || x.status !== "pronto" || !x.storage_path) return err(404, "Exportação não encontrada ou não concluída.");
    if (Date.now() - Date.parse(x.requested_at) > 7 * 86_400_000) return err(410, "Exportação expirada (7 dias). Gere uma nova.");
    const { data: url } = await db.storage.from("exportacoes").createSignedUrl(x.storage_path, 600, { download: `lexsion-exportacao-${x.requested_at.slice(0, 10)}.zip` });
    if (!url) return err(500, "Não foi possível gerar o link agora.");
    await db.from("data_exports").update({ downloads: x.downloads + 1, last_download_at: new Date().toISOString() }).eq("id", x.id);
    await db.from("audit_logs").insert({ organization_id: orgId, actor_id: who.user!.id, action: "exportacao.baixada", entity: "data_exports", entity_id: x.id, detail: "link temporário de 10 minutos" });
    return NextResponse.json({ ok: true, data: { url: url.signedUrl, expiresInMin: 10 } });
  }
  if (b.action !== "create") return err(400, "Ação desconhecida.");

  // Uma exportação por vez e no máximo 3 por dia (Supabase Free: banda e armazenamento).
  const { data: recent } = await db.from("data_exports").select("id,status,requested_at").eq("organization_id", orgId).gte("requested_at", new Date(Date.now() - 86_400_000).toISOString());
  if (recent?.some((r) => r.status === "processando" && Date.now() - Date.parse(r.requested_at) < 5 * 60_000)) return err(409, "Já há uma exportação em andamento.");
  if ((recent?.length ?? 0) >= 3) return err(429, "Limite de 3 exportações por dia.");
  const { data: job } = await db.from("data_exports").insert({ organization_id: orgId, requested_by: who.user!.id }).select("id,requested_at").single();
  await db.from("audit_logs").insert({ organization_id: orgId, actor_id: who.user!.id, action: "exportacao.solicitada", entity: "data_exports", entity_id: job!.id, detail: "exportação integral do escritório" });
  try {
    const entries: Record<string, Uint8Array> = {};
    const manifest: { arquivo: string; bytes: number; sha256: string; origem: string }[] = [];
    const put = (name: string, data: Buffer, origem: string) => { entries[name] = data; manifest.push({ arquivo: name, bytes: data.length, sha256: crypto.createHash("sha256").update(data).digest("hex"), origem }); };
    const json = (v: unknown) => Buffer.from(JSON.stringify(v, null, 2), "utf8");
    let records = 0;

    const { data: org } = await db.from("organizations").select("id,slug,name,status,plan,branding,created_at,updated_at,status_reason,ai_enabled_at").eq("id", orgId).single();
    put("dados/escritorio.json", json(org), "organizations");
    const { data: sub } = await db.from("saas_subscriptions").select("plan_id,cycle,status,price,max_users,current_period_start,current_period_end,cancel_at_period_end,created_at").eq("organization_id", orgId).maybeSingle();
    put("dados/assinatura_lexsion.json", json(sub), "saas_subscriptions");
    const { data: members } = await db.from("organization_memberships").select("user_id,role,created_at").eq("organization_id", orgId);
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = ids.length ? await db.from("profiles").select("user_id,full_name").in("user_id", ids) : { data: [] };
    const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    put("dados/equipe.json", json((members ?? []).map((m) => ({ ...m, nome: profiles?.find((p) => p.user_id === m.user_id)?.full_name ?? null, email: users?.users.find((u) => u.id === m.user_id)?.email ?? null }))), "organization_memberships + profiles");
    records += members?.length ?? 0;
    for (const [t, label] of TABLES) {
      const { data, error } = await db.from(t).select("*").eq("organization_id", orgId).limit(50_000);
      if (error) throw new Error(`leitura de ${t} falhou`);
      put(`dados/${label}.json`, json(data), t);
      records += data?.length ?? 0;
    }
    // Registros operacionais (CRM, financeiro, agenda, atendimento etc.): um JSON por coleção.
    const { data: recs } = await db.from("org_records").select("collection,id,data,version,updated_at").eq("organization_id", orgId).limit(100_000);
    const byColl = new Map<string, unknown[]>();
    for (const r of recs ?? []) byColl.set(r.collection, [...(byColl.get(r.collection) ?? []), { id: r.id, versao: r.version, atualizado_em: r.updated_at, ...(r.data as object) }]);
    for (const [c, rows] of byColl) put(`dados/registros/${c}.json`, json(rows), `org_records:${c}`);
    records += recs?.length ?? 0;
    const { data: wa } = await db.from("whatsapp_instances").select("instance_name,status,phone,created_at,updated_at").eq("organization_id", orgId).maybeSingle();
    if (wa) put("dados/whatsapp.json", json(wa), "whatsapp_instances (sem segredo do webhook)");
    const { data: audit } = await db.from("audit_logs").select("at,actor_id,actor_role,action,entity,entity_id,detail,reason").eq("organization_id", orgId).order("at").limit(100_000);
    put("dados/trilha_de_auditoria.json", json(audit), "audit_logs");
    const { data: contracts } = await db.from("saas_contracts").select("number,status,plan_id,cycle,amount,accepted_at,document_sha256,created_at").eq("organization_id", orgId);
    put("dados/contratos_lexsion.json", json(contracts), "saas_contracts");

    // Arquivos privados do escritório (bucket documentos/<org>/…), nas extensões originais.
    let total = Object.values(entries).reduce((s, e) => s + e.length, 0), files = 0;
    const walk = async (prefix: string): Promise<string[]> => {
      const out: string[] = [];
      for (let off = 0; ; off += 1000) {
        const { data } = await db.storage.from("documentos").list(prefix, { limit: 1000, offset: off });
        for (const f of data ?? []) { if (f.id) out.push(`${prefix}/${f.name}`); else out.push(...(await walk(`${prefix}/${f.name}`))); }
        if (!data || data.length < 1000) break;
      }
      return out;
    };
    const { data: docs } = await db.from("documents").select("id,name,storage_path").eq("organization_id", orgId);
    const names = new Map((docs ?? []).filter((d) => d.storage_path).map((d) => [d.storage_path as string, d.name as string]));
    for (const path of await walk(orgId)) {
      const { data: blob, error } = await db.storage.from("documentos").download(path);
      if (error || !blob) throw new Error("download de arquivo falhou");
      const buf = Buffer.from(await blob.arrayBuffer());
      total += buf.length;
      if (total > MAX_BYTES) throw new Error("os arquivos passam de 45 MB; peça a exportação assistida pelo canal de atendimento");
      const rel = path.slice(orgId.length + 1);
      const original = names.get(path)?.replace(/[\\/:*?"<>|]/g, "_");
      put(`arquivos/${rel}${original && !rel.endsWith(original) ? `__${original}` : ""}`, buf, `storage documentos/${path}`);
      files++;
    }
    put("LEIA-ME.txt", Buffer.from([
      `Exportação integral do escritório ${org?.name} (${org?.slug}) gerada em ${new Date().toISOString()} (UTC).`,
      "dados/: dados estruturados em JSON (um arquivo por tabela; dados/registros/: um arquivo por coleção operacional).",
      "arquivos/: documentos e anexos privados nas extensões originais. manifesto.json: SHA-256 de cada arquivo.",
      "Não incluídos: senhas, tokens, segredos de integração e dados de outros escritórios.",
      "Esta exportação é do ESCRITÓRIO (controlador). Pedidos individuais de titulares (LGPD, art. 18) são atendidos pelo escritório.",
    ].join("\n"), "utf8"), "gerado");
    put("manifesto.json", json({ escritorio: org?.slug, gerado_em: new Date().toISOString(), registros: records, arquivos: files, itens: manifest }), "gerado");
    const z = Buffer.from(zip(entries));
    const path = `${orgId}/${job!.id}.zip`;
    const up = await db.storage.from("exportacoes").upload(path, z, { contentType: "application/zip", upsert: false });
    if (up.error) throw new Error("gravação do ZIP falhou");
    const sha = crypto.createHash("sha256").update(z).digest("hex");
    await db.from("data_exports").update({ status: "pronto", storage_path: path, bytes: z.length, sha256: sha, files, records, finished_at: new Date().toISOString() }).eq("id", job!.id);
    await db.from("audit_logs").insert({ organization_id: orgId, actor_id: who.user!.id, action: "exportacao.pronta", entity: "data_exports", entity_id: job!.id, detail: `${records} registros, ${files} arquivos, ${Math.round(z.length / 1024)} KB` });
    return NextResponse.json({ ok: true, data: { id: job!.id, records, files, bytes: z.length } });
  } catch (e) {
    const msg = (e as Error).message.slice(0, 200);
    await db.from("data_exports").update({ status: "falhou", error: msg, finished_at: new Date().toISOString() }).eq("id", job!.id);
    await db.from("audit_logs").insert({ organization_id: orgId, actor_id: who.user!.id, action: "exportacao.falhou", entity: "data_exports", entity_id: job!.id, detail: msg });
    return err(500, `Exportação não concluída: ${msg}.`);
  }
}
