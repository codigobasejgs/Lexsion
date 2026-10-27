"use client";

// Peças pequenas reutilizadas pelos módulos E3–E7.
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useInvalidate, useSession } from "@/components/providers";
import type { CollectionName } from "@/services/mock/db";
import type { RequestContext, Result } from "@/services/contracts";
import { users } from "@/mocks/fixtures";

/** Parâmetro da URL como estado (filtros preservados na URL). */
export function useUrlState() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const set = useCallback(
    (k: string, v: string | null) => {
      const p = new URLSearchParams(sp);
      if (v) p.set(k, v);
      else p.delete(k);
      router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
    },
    [sp, router, pathname],
  );
  return { get: (k: string) => sp.get(k), set };
}

/** Executa uma ação de serviço com prevenção de duplo clique, mensagem de erro e invalidação. */
export function useAction(...collections: CollectionName[]) {
  const { ctx } = useSession();
  const invalidate = useInvalidate();
  const key = collections.join(",");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const run = useCallback(
    async <T,>(fn: (ctx: RequestContext) => Promise<Result<T>>, success?: string | ((d: T) => string)): Promise<T | null> => {
      if (!ctx || busy.current) return null;
      busy.current = true;
      setPending(true);
      setError(null);
      const r = await fn(ctx);
      busy.current = false;
      setPending(false);
      if (!r.ok) {
        setError(r.error.message);
        return null;
      }
      await invalidate(...(key.split(",") as CollectionName[]), "audit");
      if (success) setNotice(typeof success === "function" ? success(r.data) : success);
      return r.data;
    },
    [ctx, invalidate, key],
  );
  return { run, error, notice, pending, setError, setNotice };
}

export function Feedback({ error, notice }: { error: string | null; notice?: string | null }) {
  return (
    <>
      {error && <p role="alert" className="rounded-[var(--radius-control)] border border-danger/40 bg-danger-bg p-3 text-sm text-danger">{error}</p>}
      <p role="status" aria-live="polite" className={notice ? "rounded-[var(--radius-control)] border border-success/30 bg-success-bg p-3 text-sm text-success" : "sr-only"}>{notice}</p>
    </>
  );
}

export function SearchBox({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <label className="relative block min-w-0 flex-1 sm:max-w-xs">
      <span className="sr-only">{label}</span>
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" />
      <input className="field min-h-10 pl-9 text-sm" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function Chips<T extends string>({ options, value, onChange, label }: { options: { key: T; label: string; count?: number }[]; value: T; onChange: (k: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {options.map((o) => (
        <button key={o.key} onClick={() => onChange(o.key)} aria-pressed={value === o.key} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${value === o.key ? "border-brand bg-selection text-fg" : "border-line text-fg-muted hover:text-fg"}`}>
          {o.label}{o.count !== undefined && <span className="num ml-1 text-xs opacity-80">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export const userName = (id?: string) => users.find((u) => u.id === id)?.name ?? "—";

/** Lista responsiva genérica: tabela ≥ md, cartões < md. */
export function ResponsiveList<T>({ rows, columns, rowKey, caption, cardTitle, cardMeta, cardRight, href }: {
  rows: T[];
  columns: { label: string; cell: (r: T) => React.ReactNode; align?: "right" }[];
  rowKey: (r: T) => string;
  caption: string;
  cardTitle: (r: T) => React.ReactNode;
  cardMeta?: (r: T) => React.ReactNode;
  cardRight?: (r: T) => React.ReactNode;
  href?: (r: T) => string;
}) {
  return (
    <>
      <div className="panel relative hidden overflow-x-auto md:block" tabIndex={0} role="region" aria-label={`${caption} (tabela; role horizontalmente se necessário)`}>
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-line bg-surface-muted text-left text-xs uppercase tracking-wider text-fg-muted">
            <tr>{columns.map((c) => <th key={c.label} scope="col" className={`px-4 py-3 font-medium ${c.align === "right" ? "text-right" : ""}`}>{c.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={rowKey(r)} className="hover:bg-surface-muted/50">
                {columns.map((c) => <td key={c.label} className={`px-4 py-3 align-top ${c.align === "right" ? "num text-right" : ""}`}>{c.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 md:hidden">
        {rows.map((r) => {
          const inner = (
            <>
              <div className="min-w-0 flex-1">
                <p className="font-medium [overflow-wrap:anywhere]">{cardTitle(r)}</p>
                {cardMeta && <div className="mt-0.5 text-sm text-fg-muted">{cardMeta(r)}</div>}
              </div>
              {cardRight && <div className="shrink-0 text-right">{cardRight(r)}</div>}
            </>
          );
          return (
            <li key={rowKey(r)}>
              {href ? <Link href={href(r)} className="panel flex items-start gap-3 p-3">{inner}</Link> : <div className="panel flex items-start gap-3 p-3">{inner}</div>}
            </li>
          );
        })}
      </ul>
    </>
  );
}
