"use client";

import { useId } from "react";
import { AREA_GROUPS } from "@/domain/areas";

/** Campo com label persistente, dica e erro associado (aria-describedby). id = `f-${name}` para foco no erro. */
export function Field({ name, label, error, hint, optional, children }: { name: string; label: string; error?: string; hint?: string; optional?: boolean; children: (p: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => React.ReactNode }) {
  const hid = useId();
  const id = `f-${name}`;
  const describedBy = [error ? `${id}-err` : null, hint ? hid : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="min-w-0">
      <label className="label" htmlFor={id}>
        {label} {optional && <span className="font-normal text-fg-muted">(opcional)</span>}
      </label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": describedBy })}
      {hint && !error && <p id={hid} className="mt-1 text-xs text-fg-muted">{hint}</p>}
      {error && <p id={`${id}-err`} className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}

export function focusFirstError(errors: Record<string, string>) {
  const first = Object.keys(errors)[0];
  if (first) document.getElementById(`f-${first}`)?.focus();
}

export function AreaSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className="field">
      <option value="">Escolha…</option>
      {AREA_GROUPS.map((g) => (
        <optgroup key={g.group} label={g.group}>
          {g.areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

/** Lê FormData para objeto simples (checkbox ⇒ boolean). */
export function formToObject(form: HTMLFormElement): Record<string, string | boolean> {
  const fd = new FormData(form);
  const out: Record<string, string | boolean> = {};
  for (const el of Array.from(form.elements) as HTMLInputElement[]) {
    if (!el.name) continue;
    out[el.name] = el.type === "checkbox" ? el.checked : String(fd.get(el.name) ?? "");
  }
  return out;
}
