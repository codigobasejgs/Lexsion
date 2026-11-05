"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, ChevronRight, Plus } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { Badge, Dialog, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Feedback, useAction, useUrlState } from "@/modules/shared";
import { createRow, nowIso } from "@/services/mock/generic";
import { emptyIntel } from "@/domain/pension/analysis";
import { RULES_VERSION } from "@/domain/pension/rules";
import { civilFromInstant } from "@/lib/dates";

// Inteligência Jurídica e Cálculos: análises previdenciárias REAIS a partir dos documentos do cliente.
export default function InteligenciaPage() {
  const url = useUrlState();
  const rows = useCollection("assessments");
  const clients = useCollection("clients");
  const [open, setOpen] = useState(!!url.get("cliente"));
  const list = (rows.data ?? []).filter((a) => a.kind === "intel");
  return (
    <Guard area="previdenciario">
      <div className="mx-auto max-w-[1100px]">
        <PageHeader
          title="Inteligência Jurídica e Cálculos"
          description="Leitura de CNIS, CTPS e PPP com a página de origem de cada dado, revisão humana, linha do tempo, pendências, atividade especial, possibilidades de benefício e relatório."
          actions={<button className="btn btn-primary" data-tour="nova-analise-intel" onClick={() => setOpen(true)}><Plus aria-hidden className="size-4" /> Nova análise</button>}
        />
        <p role="note" className="mb-4 rounded-[var(--radius-control)] border border-info/30 bg-info-bg p-3 text-sm text-info">
          Regras {RULES_VERSION}: transcritas da legislação com fonte e vigência, <strong>aguardando validação jurídica</strong>. O sistema não decide direito: aponta o que os documentos sustentam, o que falta e onde há divergência.
        </p>
        {rows.isPending ? <LoadingBlock /> : !list.length ? (
          <EmptyState title="Nenhuma análise ainda" text="Crie uma análise para um cliente e envie o CNIS, a CTPS Digital e o PPP em PDF." action={<button className="btn btn-secondary" onClick={() => setOpen(true)}>Nova análise</button>} />
        ) : (
          <ul className="space-y-2">{list.map((a) => {
            const reviewed = a.status === "revisado" && a.reviewedVersion === a.inputsVersion;
            return (
              <li key={a.id}><Link href={`/app/inteligencia/${a.id}`} className="panel flex flex-wrap items-center gap-3 p-4 hover:border-line-strong">
                <BrainCircuit aria-hidden className="size-5 text-accent" />
                <div className="min-w-0 flex-1"><p className="font-medium">{a.title}</p><p className="text-sm text-fg-muted">{clients.data?.find((c) => c.id === a.clientId)?.name ?? "Cliente"} · versão {a.inputsVersion}</p></div>
                <Badge tone={reviewed ? "success" : "warning"}>{reviewed ? "Revisada" : "Aguardando revisão"}</Badge>
                <ChevronRight aria-hidden className="size-4 text-fg-muted" />
              </Link></li>
            );
          })}</ul>
        )}
        <NewAnalysis open={open} onClose={() => { setOpen(false); url.set("cliente", null); }} preset={url.get("cliente") ?? ""} />
      </div>
    </Guard>
  );
}

function NewAnalysis({ open, onClose, preset }: { open: boolean; onClose: () => void; preset: string }) {
  const router = useRouter();
  const { ctx } = useSession();
  const clients = useCollection("clients");
  const cases = useCollection("cases");
  const act = useAction("assessments");
  const [clientId, setClientId] = useState(preset);
  const [caseId, setCaseId] = useState("");
  const [focus, setFocus] = useState("Aposentadoria e tempo de contribuição");
  const client = clients.data?.find((c) => c.id === clientId);
  const create = async () => {
    if (!client || !ctx) return;
    const base = emptyIntel(civilFromInstant(nowIso()));
    const r = await act.run((c) => createRow("assessments", {
      kind: "intel", caseId, clientId, title: `${focus} — ${client.name}`, status: "rascunho",
      data: { ...base, birthDate: client.birthDate ?? null } as unknown as Record<string, unknown>, inputsVersion: 1, reviewedVersion: null,
      history: [{ at: nowIso(), actorId: c.actorId, text: `Análise criada (regras ${RULES_VERSION})` }],
    }, c, "Análise de inteligência jurídica criada"));
    if (r) router.push(`/app/inteligencia/${r.id}`);
  };
  return (
    <Dialog open={open} onClose={onClose} title="Nova análise">
      <div className="space-y-3 text-sm">
        <label className="block"><span className="label">Cliente</span><select className="field" value={clientId} onChange={(e) => { setClientId(e.target.value); setCaseId(""); }}><option value="">Escolha…</option>{clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="block"><span className="label">Caso (opcional)</span><select className="field" value={caseId} onChange={(e) => setCaseId(e.target.value)}><option value="">Sem caso</option>{cases.data?.filter((k) => k.clientId === clientId).map((k) => <option key={k.id} value={k.id}>{k.title}</option>)}</select></label>
        <label className="block"><span className="label">Foco</span><select className="field" value={focus} onChange={(e) => setFocus(e.target.value)}>{["Aposentadoria e tempo de contribuição", "Atividade especial", "Auxílio-acidente", "Benefício por incapacidade", "Planejamento previdenciário"].map((f) => <option key={f}>{f}</option>)}</select></label>
        <Feedback error={act.error} />
        <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={!client || act.pending} onClick={create}>Criar análise</button></div>
      </div>
    </Dialog>
  );
}
