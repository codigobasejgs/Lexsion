"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { Badge, Dialog, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Feedback, ResponsiveList, useAction } from "@/modules/shared";
import { FinanceNav } from "@/modules/finance/subnav";
import { createRow, updateRow } from "@/services/mock/generic";
import { canApprove } from "@/domain/permissions";
import { formatBRL, parseBRL } from "@/lib/money";
import { diffDays, formatCivil } from "@/lib/dates";
import { DEMO_TODAY } from "@/mocks/clock";
import type { Expense } from "@/domain/types";

export default function PagarPage() {
  const { user } = useSession();
  const exps = useCollection("expenses");
  const settings = useCollection("settings");
  const act = useAction("expenses");
  const [creating, setCreating] = useState(false);
  const rows = [...(exps.data ?? [])].sort((a, b) => a.due.localeCompare(b.due));
  const pay = (e: Expense) => act.run((ctx) => updateRow("expenses", e.id, ctx, (x: Expense) => (x.category === "Repasse a parceiro" && !canApprove(user!.role) ? "Repasse a parceiro exige aprovação de advogado(a) ou administrador." : { ...x, paidOn: DEMO_TODAY }), "Despesa paga"), "Despesa marcada como paga.");
  return (
    <Guard area="financeiro">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader title="A pagar" description="Despesas por categoria e centro de custo. Repasses a parceiros exigem aprovação." actions={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus aria-hidden className="size-4" /> Nova despesa</button>} />
        <FinanceNav />
        <Feedback error={act.error} notice={act.notice} />
        {exps.isPending ? <LoadingBlock /> : !rows.length ? <EmptyState title="Sem despesas" text="Cadastre a primeira despesa." /> : (
          <ResponsiveList rows={rows} rowKey={(e) => e.id} caption="Despesas"
            columns={[
              { label: "Descrição", cell: (e) => <><span className="block font-medium">{e.description}</span>{e.note && <span className="text-xs text-fg-muted">{e.note}</span>}</> },
              { label: "Categoria", cell: (e) => `${e.category} · ${e.costCenter}` },
              { label: "Vencimento", cell: (e) => formatCivil(e.due) },
              { label: "Valor", cell: (e) => formatBRL(e.amount), align: "right" },
              { label: "Situação", cell: (e) => (e.paidOn ? <Badge tone="success">Paga em {formatCivil(e.paidOn)}</Badge> : <span className="flex items-center gap-2"><Badge tone={diffDays(DEMO_TODAY, e.due) < 0 ? "danger" : "warning"}>Em aberto</Badge><button className="btn btn-ghost min-h-8 text-xs" onClick={() => pay(e)}>Marcar paga</button></span>) },
            ]}
            cardTitle={(e) => e.description} cardMeta={(e) => `${e.category} · vence ${formatCivil(e.due)}`} cardRight={(e) => <><p className="num font-semibold">{formatBRL(e.amount)}</p>{e.paidOn ? <Badge tone="success">Paga</Badge> : <button className="btn btn-ghost min-h-8 text-xs" onClick={(ev) => { ev.preventDefault(); pay(e); }}>Marcar paga</button>}</>} />
        )}
      </div>
      {creating && <NewExpense categories={settings.data?.[0]?.financeCategories ?? []} onClose={() => setCreating(false)} />}
    </Guard>
  );
}

function NewExpense({ categories, onClose }: { categories: string[]; onClose: () => void }) {
  const act = useAction("expenses");
  const [f, setF] = useState({ description: "", category: categories.find((c) => c !== "Honorários") ?? "Custas", costCenter: "Administrativo", amount: "", due: DEMO_TODAY });
  return (
    <Dialog open onClose={onClose} title="Nova despesa">
      <div className="space-y-3">
        <label className="block"><span className="label">Descrição</span><input className="field" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="label">Categoria</span><select className="field" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{categories.filter((c) => c !== "Honorários").map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="block"><span className="label">Centro de custo</span><select className="field" value={f.costCenter} onChange={(e) => setF({ ...f, costCenter: e.target.value })}>{["Administrativo", "Jurídico", "Comercial"].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="block"><span className="label">Valor (R$)</span><input className="field num" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
          <label className="block"><span className="label">Vencimento</span><input type="date" className="field" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></label>
        </div>
        <Feedback error={act.error} />
        <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={!f.description.trim() || !parseBRL(f.amount)} onClick={async () => { if (await act.run((ctx) => createRow("expenses", { description: f.description.trim(), category: f.category, costCenter: f.costCenter, amount: parseBRL(f.amount)!, due: f.due }, ctx, "Despesa criada"))) onClose(); }}>Salvar</button>
        </div>
      </div>
    </Dialog>
  );
}
