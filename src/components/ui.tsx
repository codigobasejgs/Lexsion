"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleDashed, Clock, FlaskConical, Info, Sparkles, XCircle } from "lucide-react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "ai" | "brand";

const TONE: Record<Tone, string> = {
  neutral: "border-line bg-surface-muted text-fg-muted",
  success: "border-success/30 bg-success-bg text-success",
  warning: "border-warning/30 bg-warning-bg text-warning",
  danger: "border-danger/30 bg-danger-bg text-danger",
  info: "border-info/30 bg-info-bg text-info",
  ai: "border-ai/30 bg-ai-bg text-ai",
  brand: "border-brand/40 bg-selection text-fg",
};

const ICON: Record<Tone, React.ElementType> = {
  neutral: CircleDashed, success: CheckCircle2, warning: AlertTriangle, danger: XCircle, info: Info, ai: Sparkles, brand: Clock,
};

/** Status sempre com ícone + texto + cor (nunca só cor). */
export function Badge({ tone = "neutral", children, icon = true, iconAs }: { tone?: Tone; children: React.ReactNode; icon?: boolean; iconAs?: React.ElementType }) {
  const I = iconAs ?? ICON[tone];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${TONE[tone]}`}>
      {icon && <I aria-hidden className="size-3.5" />}
      {children}
    </span>
  );
}

/** Selo único para todo resultado externo simulado. */
export function SimulatedBadge({ label = "Simulação" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-accent/60 px-2 py-0.5 text-xs font-medium text-accent">
      <FlaskConical aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}

export function PageHeader({ title, description, actions, breadcrumb }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; breadcrumb?: { href: string; label: string }[] }) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumb && (
          <nav aria-label="Trilha" className="mb-1 text-sm text-fg-muted">
            <ol className="flex flex-wrap items-center gap-1">
              {breadcrumb.map((b, i) => (
                <li key={b.href} className="flex items-center gap-1">
                  {i > 0 && <span aria-hidden>/</span>}
                  <Link className="hover:text-fg hover:underline" href={b.href}>{b.label}</Link>
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1 max-w-[70ch] text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-panel)] border border-dashed border-line px-6 py-10 text-center">
      <CircleDashed aria-hidden className="size-8 text-fg-muted" />
      <p className="font-medium text-fg">{title}</p>
      <p className="max-w-[48ch] text-sm text-fg-muted">{text}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-[var(--radius-control)] bg-surface-muted ${className}`} />;
}

export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Carregando" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-14" />)}
    </div>
  );
}

export function ErrorBlock({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-danger/40 bg-danger-bg p-4 text-danger sm:flex-row sm:items-center sm:justify-between">
      <p>{message}</p>
      {retry && <button className="btn btn-secondary" onClick={retry}>Tentar novamente</button>}
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter((w) => w.length > 2 || /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <span aria-hidden style={{ width: size, height: size }} className="inline-flex shrink-0 items-center justify-center rounded-full border border-brand/40 bg-selection text-xs font-semibold text-accent">
      {initials || "?"}
    </span>
  );
}

/** Diálogo nativo: foco, Esc e trap pelo navegador. Foco volta ao acionador ao fechar. */
export function Dialog({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      d.showModal();
    } else if (!open && d.open) {
      d.close();
      (opener.current as HTMLElement | null)?.focus?.();
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className={`m-auto max-h-[min(90dvh,800px)] w-[calc(100vw-2rem)] ${wide ? "max-w-3xl" : "max-w-lg"} flex-col rounded-[var(--radius-dialog)] border border-line bg-surface p-0 text-fg backdrop:bg-[var(--scrim)] open:flex`}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
        <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
        <button className="btn btn-ghost min-h-9 px-2" onClick={onClose} aria-label="Fechar">✕</button>
      </div>
      {/* Corpo rolável: em telas baixas (zoom 200%, teclado virtual aberto) as ações continuam alcançáveis. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
    </dialog>
  );
}

export function Stat({ label, value, href, hint, tone = "neutral" }: { label: string; value: React.ReactNode; href: string; hint?: string; tone?: Tone }) {
  return (
    <Link href={href} className="panel group flex flex-col gap-1 p-4 transition-colors hover:border-line-strong">
      <span className="text-sm text-fg-muted">{label}</span>
      <span className={`num text-2xl font-semibold ${tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-fg"}`}>{value}</span>
      {hint && <span className="text-xs text-fg-muted group-hover:text-fg">{hint}</span>}
    </Link>
  );
}
