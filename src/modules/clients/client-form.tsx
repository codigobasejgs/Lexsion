"use client";

import { useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Field, focusFirstError, formToObject } from "@/components/form";
import { useCollection, useSession } from "@/components/providers";
import { useDirtyGuard } from "@/components/pwa";
import { clientSchema, fieldErrors, UFS, type ClientInput } from "@/domain/schemas";
import { findClientMatches } from "@/domain/crm";
import { parseCivilBR, formatCivil } from "@/lib/dates";
import { people as users } from "@/components/people";

export interface ClientFormDefaults {
  name?: string;
  phone?: string;
  email?: string;
  city?: string;
  uf?: string;
  origin?: string;
  ownerId?: string;
}

/**
 * Formulário de cliente. Mostra possíveis duplicados (por documento/telefone) antes de salvar;
 * documento repetido bloqueia, telefone repetido só alerta (família pode compartilhar).
 */
export function ClientForm({ defaults, submitLabel, onSubmit, onCancel, onPickExisting }: {
  defaults?: ClientFormDefaults;
  submitLabel: string;
  onSubmit: (input: ClientInput) => Promise<string | null>; // retorna mensagem de erro ou null
  onCancel: () => void;
  onPickExisting?: (clientId: string) => void;
}) {
  const { org } = useSession();
  const clients = useCollection("clients");
  const [kind, setKind] = useState<"PF" | "PJ">("PF");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [probe, setProbe] = useState({ phone: defaults?.phone ?? "", document: "" });
  const formRef = useRef<HTMLFormElement>(null);
  useDirtyGuard("client-form", dirty);

  const matches = findClientMatches((clients.data ?? []).filter((c) => c.organizationId === org?.id), probe);
  const team = users.filter((u) => u.organizationId === org?.id && u.role !== "cliente");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    const raw = formToObject(e.currentTarget);
    const birth = String(raw.birthDate ?? "");
    const parsed = clientSchema.safeParse({ ...raw, kind, birthDate: birth ? parseCivilBR(birth) ?? "x" : "" });
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors(errs);
      focusFirstError(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const err = await onSubmit(parsed.data);
    setSubmitting(false);
    if (err) setFormError(err);
    else setDirty(false);
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate onChange={() => setDirty(true)} className="space-y-4">
      <fieldset className="min-w-0">
        <legend className="label">Tipo</legend>
        <div role="radiogroup" className="inline-flex rounded-[var(--radius-control)] border border-line p-0.5 text-sm">
          {(["PF", "PJ"] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`rounded-md px-3 py-1.5 ${kind === k ? "bg-brand text-on-brand" : "text-fg-muted"}`}>
              {k === "PF" ? "Pessoa física" : "Pessoa jurídica"}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label={kind === "PF" ? "Nome completo" : "Razão social"} error={errors.name}>
          {(p) => <input {...p} name="name" className="field" autoComplete={kind === "PF" ? "name" : "organization"} defaultValue={defaults?.name} />}
        </Field>
        {kind === "PF" && (
          <Field name="socialName" label="Nome social" optional error={errors.socialName}>
            {(p) => <input {...p} name="socialName" className="field" />}
          </Field>
        )}
        <Field name="document" label={kind === "PF" ? "CPF" : "CNPJ"} error={errors.document} hint="Dado sensível: aparece mascarado nas listas.">
          {(p) => <input {...p} name="document" className="field num" inputMode="numeric" autoComplete="off" placeholder={kind === "PF" ? "000.000.000-00" : "00.000.000/0000-00"} onBlur={(e) => setProbe((s) => ({ ...s, document: e.target.value }))} />}
        </Field>
        {kind === "PF" && (
          <Field name="birthDate" label="Data de nascimento" optional error={errors.birthDate}>
            {(p) => <input {...p} name="birthDate" className="field num" inputMode="numeric" placeholder="dd/mm/aaaa" autoComplete="bday" />}
          </Field>
        )}
        <Field name="phone" label="Telefone (WhatsApp)" error={errors.phone}>
          {(p) => <input {...p} name="phone" className="field num" type="tel" inputMode="tel" autoComplete="tel" defaultValue={defaults?.phone} onBlur={(e) => setProbe((s) => ({ ...s, phone: e.target.value }))} />}
        </Field>
        <Field name="email" label="E-mail" optional error={errors.email}>
          {(p) => <input {...p} name="email" className="field" type="email" inputMode="email" autoComplete="email" defaultValue={defaults?.email} />}
        </Field>
        <Field name="city" label="Cidade" error={errors.city}>
          {(p) => <input {...p} name="city" className="field" autoComplete="address-level2" defaultValue={defaults?.city} />}
        </Field>
        <Field name="uf" label="UF" error={errors.uf}>
          {(p) => (
            <select {...p} name="uf" className="field" defaultValue={defaults?.uf || "BA"}>
              {UFS.map((u) => <option key={u}>{u}</option>)}
            </select>
          )}
        </Field>
        {kind === "PF" && (
          <Field name="profession" label="Profissão" optional error={errors.profession}>
            {(p) => <input {...p} name="profession" className="field" />}
          </Field>
        )}
        <Field name="ownerId" label="Responsável" error={errors.ownerId}>
          {(p) => (
            <select {...p} name="ownerId" className="field" defaultValue={defaults?.ownerId ?? team.find((u) => u.role === "advogado")?.id ?? team[0]?.id}>
              {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
        </Field>
      </div>
      <input type="hidden" name="origin" value={defaults?.origin ?? ""} />

      {matches.length > 0 && (
        <div role="status" className="rounded-[var(--radius-control)] border border-warning/40 bg-warning-bg p-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-warning"><AlertTriangle aria-hidden className="size-4" /> Possível cadastro existente</p>
          <ul className="mt-2 space-y-2">
            {matches.map((m) => (
              <li key={m.client.id} className="flex flex-wrap items-center gap-2">
                <span className="flex-1">{m.client.name} · mesmo {m.by} · desde {formatCivil(m.client.createdAt.slice(0, 10))}</span>
                {onPickExisting && <button type="button" className="btn btn-secondary min-h-9" onClick={() => onPickExisting(m.client.id)}>Usar este cadastro</button>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-fg-muted">Confira antes de criar outro. Mesmo telefone pode ser de um familiar.</p>
        </div>
      )}

      {formError && <p role="alert" className="rounded-[var(--radius-control)] border border-danger/40 bg-danger-bg p-3 text-sm text-danger">{formError}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" disabled={submitting}>{submitting ? "Salvando…" : submitLabel}</button>
      </div>
    </form>
  );
}
