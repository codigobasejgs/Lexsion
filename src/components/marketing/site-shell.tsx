"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { LexSionLogo } from "@/components/brand";

export const SITE_NAV = [
  { href: "/funcionalidades", label: "Funcionalidades" },
  { href: "/solucoes", label: "Soluções" },
  { href: "/planos", label: "Planos" },
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#perguntas", label: "Perguntas frequentes" },
];

// Shell público da LexSion (marca-mãe). Sem dados de escritório, sem sessão.
export function SiteShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha o menu móvel ao navegar
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
          <Link href="/" aria-label="LexSion — página inicial" className="shrink-0"><LexSionLogo className="h-8" /></Link>
          <nav aria-label="Site" className="ml-4 hidden items-center gap-1 lg:flex">
            {SITE_NAV.map((n) => <Link key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined} className={`rounded px-3 py-2 text-sm ${path === n.href ? "text-fg" : "text-fg-muted hover:text-fg"}`}>{n.label}</Link>)}
          </nav>
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <Link href="/entrar" className="btn btn-ghost">Entrar</Link>
            <Link href="/demonstracao" className="btn btn-secondary">Ver demonstração</Link>
            <Link href="/contato" className="btn btn-primary hidden md:inline-flex">Solicitar apresentação</Link>
          </div>
          <button className="btn btn-ghost ml-auto px-2 sm:ml-0 lg:hidden" aria-label="Abrir menu" aria-expanded={open} aria-controls="menu-site" onClick={() => setOpen(true)}><Menu aria-hidden className="size-5" /></button>
        </div>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-[var(--scrim)]" aria-label="Fechar menu" onClick={() => setOpen(false)} />
          <div id="menu-site" role="dialog" aria-modal="true" aria-label="Menu do site" className="absolute inset-y-0 right-0 flex w-[min(320px,88vw)] flex-col gap-2 bg-surface p-5">
            <div className="mb-2 flex items-center justify-between"><LexSionLogo className="h-7" /><button className="btn btn-ghost px-2" aria-label="Fechar menu" autoFocus onClick={() => setOpen(false)}><X aria-hidden className="size-5" /></button></div>
            {SITE_NAV.map((n) => <Link key={n.href} href={n.href} className="flex min-h-11 items-center rounded px-3 text-fg hover:bg-surface-muted">{n.label}</Link>)}
            <div className="mt-auto grid gap-2">
              <Link href="/contato" className="btn btn-primary">Solicitar apresentação</Link>
              <Link href="/demonstracao" className="btn btn-secondary">Ver demonstração</Link>
              <Link href="/entrar" className="btn btn-ghost">Entrar</Link>
            </div>
          </div>
        </div>
      )}
      <main id="conteudo" className="flex-1">{children}</main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <LexSionLogo className="h-8" />
            <p className="text-sm text-fg-muted">Toda a advocacia. Uma plataforma.</p>
          </div>
          <nav aria-label="Produto" className="space-y-2 text-sm">
            <p className="font-semibold">Produto</p>
            <Link href="/funcionalidades" className="block text-fg-muted hover:text-fg">Funcionalidades</Link>
            <Link href="/solucoes" className="block text-fg-muted hover:text-fg">Soluções</Link>
            <Link href="/planos" className="block text-fg-muted hover:text-fg">Planos</Link>
            <Link href="/demonstracao" className="block text-fg-muted hover:text-fg">Demonstração</Link>
          </nav>
          <nav aria-label="Empresa" className="space-y-2 text-sm">
            <p className="font-semibold">Empresa</p>
            <Link href="/sobre" className="block text-fg-muted hover:text-fg">Sobre</Link>
            <Link href="/contato" className="block text-fg-muted hover:text-fg">Contato</Link>
            <Link href="/instalar" className="block text-fg-muted hover:text-fg">Instalar o aplicativo</Link>
          </nav>
          <nav aria-label="Legal" className="space-y-2 text-sm">
            <p className="font-semibold">Legal</p>
            <Link href="/privacidade" className="block text-fg-muted hover:text-fg">Privacidade</Link>
            <Link href="/termos" className="block text-fg-muted hover:text-fg">Termos de uso</Link>
            <Link href="/entrar" className="block text-fg-muted hover:text-fg">Entrar</Link>
          </nav>
        </div>
        <p className="border-t border-line px-5 py-4 text-center text-xs text-fg-muted">© {new Date().getFullYear()} LexSion. Software para escritórios de advocacia — não presta serviços jurídicos.</p>
      </footer>
    </div>
  );
}
