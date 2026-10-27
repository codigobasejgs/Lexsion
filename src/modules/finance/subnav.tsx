"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  ["/app/financeiro", "Visão geral"],
  ["/app/financeiro/receber", "A receber"],
  ["/app/financeiro/pagar", "A pagar"],
  ["/app/financeiro/caixa", "Caixa"],
  ["/app/financeiro/conciliacao", "Conciliação"],
  ["/app/financeiro/recibos", "Recibos"],
  ["/app/pagamentos", "Cobranças"],
] as const;

export function FinanceNav() {
  const path = usePathname();
  return (
    <nav aria-label="Financeiro" className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-line px-1">
      {ITEMS.map(([href, label]) => (
        <Link key={href} href={href} aria-current={path === href ? "page" : undefined} className={`-mb-px min-h-11 shrink-0 border-b-2 px-3 py-3 text-sm ${path === href ? "border-brand font-medium" : "border-transparent text-fg-muted hover:text-fg"}`}>{label}</Link>
      ))}
    </nav>
  );
}
