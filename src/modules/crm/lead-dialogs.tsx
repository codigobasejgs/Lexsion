"use client";

import { useRef, useState } from "react";
import { Dialog } from "@/components/ui";
import { AreaSelect, Field, focusFirstError, formToObject } from "@/components/form";
import { useInvalidate, useSession } from "@/components/providers";
import { crmService } from "@/services/mock/crm-repo";
import { fieldErrors, leadSchema, UFS } from "@/domain/schemas";
import { LOST_REASONS, STAGE_ERROR_MSG, STAGE_LABEL, STAGES } from "@/domain/crm";
import type { Lead, StageKey } from "@/domain/types";
import { users } from "@/mocks/fixtures";

export function NewLeadDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { ctx, org } = useSession();
  const invalidate = useInvalidate();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const team = users.filter((u) => u.organizationId === org?.id && u.role !== "cliente");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !ctx) return;
    const parsed = leadSchema.safeParse(formToObject(e.currentTarget));
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors(errs);
      focusFirstError(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    const r = await crmService.createLead(parsed.data, ctx);
    setBusy(false);
    if (!r.ok) return setFormError(r.error.message);
    await invalidate("leads", "audit");
    onCreated(r.data.id);
  };

  return (
    <Dialog open={open} onClose={onClose} title="Novo lead" wide>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="name" label="Nome" error={errors.name}>{(p) => <input {...p} name="name" className="field" autoComplete="name" />}</Field>
          <Field name="phone" label="Telefone (WhatsApp)" error={errors.phone}>{(p) => <input {...p} name="phone" type="tel" inputMode="tel" className="field num" autoComplete="tel" />}</Field>
          <Field name="email" label="E-mail" optional error={errors.email}>{(p) => <input {...p} name="email" type="email" className="field" autoComplete="email" />}</Field>
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <Field name="city" label="Cidade" optional error={errors.city}>{(p) => <input {...p} name="city" className="field" />}</Field>
            <Field name="uf" label="UF" optional error={errors.uf}>{(p) => <select {...p} name="uf" className="field" defaultValue=""><option value="">—</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>}</Field>
          </div>
          <Field name="area" label="Área" error={errors.area}>{(p) => <AreaSelect {...p} name="area" defaultValue="Previdenciário" />}</Field>
          <Field name="service" label="Serviço de interesse" error={errors.service}>{(p) => <input {...p} name="service" className="field" placeholder="Ex.: BPC/LOAS" />}</Field>
          <Field name="declaredOrigin" label="Como conheceu o escritório" optional hint="Fica registrado como origem declarada, não confirmada." error={errors.declaredOrigin}>
            {(p) => <select {...p} name="declaredOrigin" className="field" defaultValue=""><option value="">Não informado</option>{["Indicação de cliente", "Indicação de parceiro", "Instagram orgânico", "Site do escritório", "WhatsApp orgânico", "Outro"].map((o) => <option key={o}>{o}</option>)}</select>}
          </Field>
          <Field name="ownerId" label="Responsável" optional error={errors.ownerId}>
            {(p) => <select {...p} name="ownerId" className="field" defaultValue=""><option value="">Sem responsável</option>{team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>}
          </Field>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consentContact" defaultChecked className="mt-0.5 size-4 accent-[var(--brand)]" />
          <span>A pessoa autorizou ser contatada pelo escritório. Sem autorização, follow-ups automáticos ficam desligados.</span>
        </label>
        {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Salvando…" : "Salvar lead"}</button>
        </div>
      </form>
    </Dialog>
  );
}

/** Mover etapa sem arrastar (alternativa acessível ao Kanban). Perda pede motivo antes de mover. */
export function MoveStageDialog({ lead, to: initialTo, onClose }: { lead: Lead; to?: StageKey; onClose: () => void }) {
  const { ctx } = useSession();
  const invalidate = useInvalidate();
  const [to, setTo] = useState<StageKey>(initialTo ?? lead.stage);
  const [reason, setReason] = useState(LOST_REASONS[0]);
  const [other, setOther] = useState("");
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const confirm = async () => {
    if (!ctx || busy.current) return;
    if (to === lead.stage) return setError(STAGE_ERROR_MSG.same_stage);
    busy.current = true;
    const note = to === "perdido" ? (reason === "Outro" ? other : reason) : undefined;
    const r = await crmService.moveStage(lead.id, to, ctx, note);
    busy.current = false;
    if (!r.ok) return setError(r.error.message);
    await invalidate("leads", "audit");
    onClose();
  };

  return (
    <Dialog open onClose={onClose} title={`Mover ${lead.name}`}>
      <div className="space-y-4">
        <p className="text-sm text-fg-muted">Etapa atual: <strong className="text-fg">{STAGE_LABEL[lead.stage]}</strong></p>
        <label className="block">
          <span className="label">Nova etapa</span>
          <select className="field" value={to} onChange={(e) => { setTo(e.target.value as StageKey); setError(null); }}>
            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        {to === "contratado" && !lead.clientId && <p className="text-sm text-warning">Para marcar como contratado, converta o lead em cliente primeiro (na ficha do lead).</p>}
        {to === "perdido" && (
          <div className="space-y-2">
            <label className="block">
              <span className="label">Motivo da perda</span>
              <select className="field" value={reason} onChange={(e) => setReason(e.target.value)}>{LOST_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
            </label>
            {reason === "Outro" && <label className="block"><span className="label">Descreva</span><input className="field" value={other} onChange={(e) => setOther(e.target.value)} /></label>}
            <p className="text-xs text-fg-muted">Lead perdido fica arquivado com histórico e pode ser reaberto.</p>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={confirm}>Mover para {STAGE_LABEL[to]}</button>
        </div>
      </div>
    </Dialog>
  );
}
