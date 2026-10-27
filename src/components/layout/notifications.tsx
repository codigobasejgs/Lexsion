"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useCollection, useSession } from "@/components/providers";
import { useAction } from "@/modules/shared";
import { ok, updateRow } from "@/services/mock/generic";
import { formatInstant } from "@/lib/dates";
import type { AppNotification } from "@/domain/types";

const TONE = { info: "text-info", atencao: "text-warning", urgente: "text-danger" } as const;

/** Central de notificações no app (não depende de push). */
export function NotificationBell() {
  const { user } = useSession();
  const all = useCollection("notifications");
  const act = useAction("notifications");
  const mine = (all.data ?? []).filter((n) => !n.userId || n.userId === user?.id).sort((a, b) => b.at.localeCompare(a.at));
  const unread = mine.filter((n) => !n.read);
  const markAll = () => act.run(async (ctx) => {
    for (const n of unread) await updateRow("notifications", n.id, ctx, (x: AppNotification) => ({ ...x, read: true }), "Notificação lida");
    return ok(null);
  });
  return (
    <details className="relative">
      <summary className="relative flex min-h-10 min-w-10 cursor-pointer list-none items-center justify-center rounded-[var(--radius-control)] hover:bg-surface-muted" aria-label={`Notificações${unread.length ? `, ${unread.length} não lidas` : ""}`} data-tour="notificacoes">
        <Bell aria-hidden className="size-5" />
        {unread.length > 0 && <span aria-hidden className="absolute right-1 top-1 inline-flex min-w-4 justify-center rounded-full bg-brand px-1 text-[0.65rem] font-bold text-on-brand">{unread.length}</span>}
      </summary>
      <div className="absolute right-0 top-12 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-[var(--radius-panel)] border border-line bg-surface-raised p-2 shadow-xl">
        <div className="flex items-center justify-between px-2 py-1"><p className="font-medium">Notificações</p>{unread.length > 0 && <button className="text-xs text-accent underline" onClick={markAll}>Marcar todas como lidas</button>}</div>
        {mine.length === 0 ? <p className="p-3 text-sm text-fg-muted">Nada por aqui.</p> : (
          <ul className="max-h-80 overflow-y-auto">
            {mine.map((n) => (
              <li key={n.id}><Link href={n.href} className={`block rounded px-2 py-2 text-sm hover:bg-surface-muted ${n.read ? "text-fg-muted" : ""}`}>
                <span className={`mr-1 font-semibold ${TONE[n.severity]}`}>{n.severity === "urgente" ? "Urgente:" : n.severity === "atencao" ? "Atenção:" : ""}</span>{n.text}
                <span className="block text-xs text-fg-muted">{formatInstant(n.at)}</span>
              </Link></li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
