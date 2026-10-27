"use client";

import { useRef, useState } from "react";
import { AreaSelect, Field, focusFirstError, formToObject } from "@/components/form";
import { useInvalidate, useSession } from "@/components/providers";
import { caseService } from "@/services/mock/crm-repo";
import { caseSchema, fieldErrors } from "@/domain/schemas";
import type { Case } from "@/domain/types";
import { users } from "@/mocks/fixtures";

/** Abrir caso para um cliente. Caso ≠ processo: processos entram depois, no caso. */
export function CaseForm({ clientId, defaults, onDone, onCancel }: { clientId: string; defaults?: { area?: string; service?: string; title?: string }; onDone: (k: Case) => void; onCancel: () => void }) {
  const { ctx, org } = useSession();
  const invalidate = useInvalidate();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID().slice(0, 8));
  const lawyers = users.filter((u) => u.organizationId === org?.id && (u.role === "advogado" || u.role === "admin" || u.role === "estagiario"));

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !ctx) return;
    const parsed = caseSchema.safeParse({ ...formToObject(e.currentTarget), clientId });
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors(errs);
      focusFirstError(errs);
      return;
    }
    setBusy(true);
    const r = await caseService.create(parsed.data, { ...ctx, idempotencyKey: key.current });
    setBusy(false);
    if (!r.ok) return setFormError(r.error.message);
    await invalidate("cases", "audit");
    onDone(r.data);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="title" label="Título do caso" error={errors.title}>{(p) => <input {...p} name="title" className="field" defaultValue={defaults?.title} />}</Field>
        <Field name="area" label="Área" error={errors.area}>{(p) => <AreaSelect {...p} name="area" defaultValue={defaults?.area ?? "Previdenciário"} />}</Field>
        <Field name="service" label="Serviço" error={errors.service}>{(p) => <input {...p} name="service" className="field" defaultValue={defaults?.service} />}</Field>
        <Field name="kind" label="Tipo" error={errors.kind}>
          {(p) => <select {...p} name="kind" className="field" defaultValue="administrativo"><option value="consultivo">Consultivo</option><option value="administrativo">Administrativo</option><option value="judicial">Judicial</option></select>}
        </Field>
        <Field name="priority" label="Prioridade" error={errors.priority}>
          {(p) => <select {...p} name="priority" className="field" defaultValue="normal"><option value="baixa">Baixa</option><option value="normal">Normal</option><option value="alta">Alta</option></select>}
        </Field>
        <Field name="ownerId" label="Responsável" error={errors.ownerId}>
          {(p) => <select {...p} name="ownerId" className="field" defaultValue={lawyers.find((u) => u.role === "advogado")?.id}>{lawyers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>}
        </Field>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confidential" className="mt-0.5 size-4 accent-[var(--brand)]" />
        <span>Caso sigiloso (acesso restrito à equipe designada).</span>
      </label>
      {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Abrindo…" : "Abrir caso"}</button>
      </div>
    </form>
  );
}
