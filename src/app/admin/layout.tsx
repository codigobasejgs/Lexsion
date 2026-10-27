"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Building2, CreditCard, FlaskConical, Layers, LifeBuoy, LogOut, Menu, ScrollText, X } from "lucide-react";
import { useSession } from "@/components/providers";
import { LexSionLogo } from "@/components/brand";
import { isPlatformRole } from "@/domain/permissions";

const NAV = [
  { href: "/admin", label: "Painel geral", icon: BarChart3 },
  { href: "/admin/organizacoes", label: "Contratantes", icon: Building2 },
  { href: "/admin/planos", label: "Planos e assinaturas", icon: Layers },
  { href: "/admin/faturamento", label: "Financeiro da plataforma", icon: CreditCard },
  { href: "/admin/suporte", label: "Suporte", icon: LifeBuoy },
  { href: "/admin/auditoria", label: "Auditoria", icon: ScrollText },
];

// Shell do Super Admin: marca LexSion, sem identidade de escritório, sem acesso a conteúdo sigiloso dos escritórios.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { ready, user, signOut } = useSession();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (ready && !isPlatformRole(user?.role)) router.replace("/demonstracao");
  }, [ready, user, router]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha o menu móvel ao navegar
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open]);
  if (!ready || !isPlatformRole(user?.role)) return <div className="min-h-dvh bg-canvas" aria-busy="true" />;
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  const nav = (
    <nav aria-label="Super Admin" className="space-y-0.5">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm ${active(href) ? "bg-selection font-medium text-fg shadow-[inset_2px_0_0_var(--brand)]" : "text-fg-muted hover:bg-surface-muted hover:text-fg"}`}>
          <Icon aria-hidden className="size-[18px]" /> {label}
        </Link>
      ))}
    </nav>
  );
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col gap-4 border-r border-line bg-surface p-4 lg:flex">
        <LexSionLogo className="h-9" />
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fg-muted">Super Admin</p>
        {nav}
        <button onClick={signOut} className="mt-auto flex min-h-11 items-center gap-2 rounded px-3 text-sm text-danger hover:bg-danger-bg"><LogOut aria-hidden className="size-4" /> Sair</button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-center gap-2 bg-ai-bg px-4 py-1 text-xs text-ai"><FlaskConical aria-hidden className="size-3.5" /> Ambiente demonstrativo — dados fictícios. Nenhuma cobrança real.</div>
        <header className="flex h-14 items-center gap-3 border-b border-line px-4 lg:hidden">
          <button className="btn btn-ghost px-2" aria-label="Abrir menu" aria-expanded={open} aria-controls="admin-drawer" onClick={() => setOpen(true)}><Menu aria-hidden className="size-5" /></button>
          <LexSionLogo className="h-7" />
        </header>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button className="absolute inset-0 bg-[var(--scrim)]" aria-label="Fechar menu" onClick={() => setOpen(false)} />
            <div id="admin-drawer" role="dialog" aria-modal="true" aria-label="Menu do Super Admin" className="relative flex h-full w-[min(300px,85vw)] flex-col gap-4 bg-surface p-4">
              <div className="flex items-center justify-between"><LexSionLogo className="h-8" /><button className="btn btn-ghost px-2" aria-label="Fechar menu" autoFocus onClick={() => setOpen(false)}><X aria-hidden className="size-5" /></button></div>
              {nav}
              <button onClick={signOut} className="mt-auto flex min-h-11 items-center gap-2 rounded px-3 text-sm text-danger hover:bg-danger-bg"><LogOut aria-hidden className="size-4" /> Sair</button>
            </div>
          </div>
        )}
        <main id="conteudo" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-[1200px] flex-1 px-4 py-6 outline-none sm:px-6">{children}</main>
      </div>
    </div>
  );
}
