"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronsLeft, ChevronsRight, FlaskConical, LogOut, Plus, Search } from "lucide-react";
import { useSession } from "@/components/providers";
import { can, isPlatformRole, ROLE_LABEL, type Area } from "@/domain/permissions";
import { organizations } from "@/mocks/fixtures";
import { MOBILE_TABS, MORE_ICON, NAV_GROUPS } from "./nav";
import dynamic from "next/dynamic";
// Paleta (com o índice de artigos da ajuda) só é baixada quando aberta.
const CommandPalette = dynamic(() => import("./command-palette").then((m) => m.CommandPalette), { ssr: false });
import { NotificationBell } from "./notifications";
import { ScreenHelp } from "./screen-help";
import { Dialog } from "@/components/ui";
import { TenantLogo } from "@/components/brand";

function useActive() {
  const path = usePathname();
  return (href: string) => path === href || path.startsWith(href + "/");
}

// Marca do ESCRITÓRIO no ERP (white-label); LexSion só aparece no Super Admin e nas páginas da plataforma.
function Wordmark({ compact }: { compact?: boolean }) {
  const { tenant, org } = useSession();
  const name = tenant?.settings.brandName ?? org?.name ?? "Escritório";
  return (
    <Link href="/app/inicio" className="flex min-w-0 items-center gap-2 rounded px-1" aria-label={`${name} — ir para Meu dia`}>
      <TenantLogo src={tenant?.settings.logoDark} name={name} className="size-8 shrink-0" />
      {!compact && <span className="truncate text-[0.95rem] font-semibold text-fg">{name}</span>}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, user, org, tenant, switchOrg, signOut } = useSession();
  const router = useRouter();
  const isActive = useActive();
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Menu recolhido lembrado por escritório + usuário.
  const collapseKey = `siwiltec.sidebar.${org?.id ?? "default"}.${user?.id ?? "anon"}`;

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferência local lida após montar
      setCollapsed(localStorage.getItem(collapseKey) === "1");
    } catch {}
  }, [collapseKey]);
  useEffect(() => {
    if (ready && !user) router.replace("/demonstracao");
    else if (ready && user?.role === "cliente") router.replace("/portal");
    else if (ready && isPlatformRole(user?.role)) router.replace("/admin");
  }, [ready, user, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groups = useMemo(
    () => NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => user && can(user.role, i.area as Area)) })).filter((g) => g.items.length),
    [user],
  );
  // Troca de escritório: só demonstração (perfil admin vê os escritórios demo de origem). Em produção, por vínculo (membership).
  const myOrgs = user?.role === "admin" ? organizations.filter((o) => o.id !== "org-novo" || o.id === user.organizationId) : organizations.filter((o) => o.id === user?.organizationId);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(collapseKey, c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  if (!ready || !user || !org) {
    return <div className="min-h-dvh bg-canvas" aria-busy="true" />;
  }
  // Escritório suspenso/cancelado: nenhuma tela com dados abre (F16). Sair continua disponível.
  if (tenant && (tenant.status === "suspensa" || tenant.status === "cancelada" || tenant.status === "removida")) {
    return (
      <main id="conteudo" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-5 text-center">
        <h1 className="text-2xl font-semibold">{tenant.status === "suspensa" ? "Acesso suspenso" : "Assinatura encerrada"}</h1>
        <p className="text-fg-muted">O acesso de {tenant.settings.brandName} está {tenant.status === "suspensa" ? "temporariamente suspenso" : "encerrado"}. Os dados foram preservados. Fale com o responsável pelo escritório ou com o suporte LexSion.</p>
        <button className="btn btn-secondary" onClick={signOut}><LogOut aria-hidden className="size-4" /> Sair</button>
      </main>
    );
  }

  // mode "rail": rótulo oculto até lg (ou sempre, se recolhido); "full": rótulo sempre visível (menu Mais).
  const navLink = (item: (typeof groups)[number]["items"][number], mode: "rail" | "full") => {
    const Icon = item.icon;
    const active = isActive(item.href);
    const showLabel = mode === "full" ? "" : collapsed ? "sr-only" : "sr-only lg:not-sr-only";
    const layout = mode === "full" ? "px-3" : collapsed ? "justify-center" : "justify-center lg:justify-start lg:px-3";
    return (
      <Link
        key={item.href}
        href={item.href}
        data-tour={mode === "rail" ? item.tour : undefined}
        aria-current={active ? "page" : undefined}
        title={mode === "rail" ? item.label : undefined}
        className={`flex min-h-10 items-center gap-3 rounded-[var(--radius-control)] text-sm transition-colors ${layout} ${
          active ? "bg-selection font-medium text-fg shadow-[inset_2px_0_0_var(--brand)]" : "text-fg-muted hover:bg-surface-muted hover:text-fg"
        }`}
      >
        <Icon aria-hidden className={`size-[18px] shrink-0 ${active ? "text-brand" : ""}`} />
        <span className={`truncate ${showLabel}`}>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="flex min-h-dvh">
      {/* Rail (600–1023) e sidebar (≥1024). Abaixo de 600: barra inferior. */}
      <aside
        aria-label="Navegação principal"
        className={`no-print sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface pt-[env(safe-area-inset-top)] sm:flex ${collapsed ? "w-[72px]" : "w-[72px] lg:w-[260px]"}`}
      >
        <div className="flex h-16 items-center px-3">
          <span className="lg:hidden"><Wordmark compact /></span>
          <span className="hidden lg:block">{collapsed ? <Wordmark compact /> : <Wordmark />}</span>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {groups.map((g) => (
            <div key={g.label}>
              <p className={`mb-1 px-3 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-fg-muted ${collapsed ? "sr-only" : "sr-only lg:not-sr-only lg:block"}`}>{g.label}</p>
              <div className="space-y-0.5">{g.items.map((i) => navLink(i, "rail"))}</div>
            </div>
          ))}
        </nav>
        <button onClick={toggle} className="m-3 hidden min-h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] text-sm text-fg-muted hover:bg-surface-muted hover:text-fg lg:flex" aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}>
          {collapsed ? <ChevronsRight aria-hidden className="size-4" /> : <><ChevronsLeft aria-hidden className="size-4" /> Recolher</>}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="no-print flex items-center justify-center gap-2 border-b border-accent/20 bg-ai-bg px-4 py-1 text-center text-xs text-ai">
          <FlaskConical aria-hidden className="size-3.5" />
          Ambiente demonstrativo — dados fictícios
        </div>
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-canvas/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur sm:h-16 sm:px-6">
          <span className="sm:hidden"><Wordmark compact /></span>
          <button
            onClick={() => setPaletteOpen(true)}
            data-tour="busca-global"
            className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-left text-sm text-fg-muted hover:border-line-strong sm:max-w-md"
          >
            <Search aria-hidden className="size-4 shrink-0" />
            <span className="truncate">Buscar clientes, casos, ajuda…</span>
            <kbd className="ml-auto hidden rounded border border-line px-1.5 text-[0.7rem] sm:inline">Ctrl K</kbd>
          </button>
          <button onClick={() => setPaletteOpen(true)} className="btn btn-primary hidden sm:inline-flex" data-tour="botao-novo">
            <Plus aria-hidden className="size-4" /> Novo
          </button>
          <div className="ml-auto flex items-center gap-2">
            {myOrgs.length > 1 ? (
              <label className="hidden items-center gap-2 md:flex">
                <Building2 aria-hidden className="size-4 text-fg-muted" />
                <span className="sr-only">Escritório</span>
                <select className="field min-h-10 w-auto max-w-[300px] text-sm" value={org.id} onChange={(e) => switchOrg(e.target.value)} data-tour="troca-escritorio">
                  {myOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
            ) : (
              <span className="hidden max-w-[220px] truncate text-sm text-fg-muted md:inline">{org.name}</span>
            )}
            <ScreenHelp />
            <NotificationBell />
            <details className="relative">
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-[var(--radius-control)] px-2 hover:bg-surface-muted">
                <span aria-hidden className="inline-flex size-8 items-center justify-center rounded-full border border-brand/40 bg-selection text-xs font-semibold text-accent">
                  {user.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </span>
                <span className="sr-only">Menu do usuário</span>
              </summary>
              <div className="absolute right-0 top-12 z-40 w-72 rounded-[var(--radius-panel)] border border-line bg-surface-raised p-2 shadow-xl">
                <div className="border-b border-line px-3 py-2">
                  <p className="font-medium">{user.name}</p>
                  <p className="text-xs text-fg-muted">{ROLE_LABEL[user.role]} · {org.name}</p>
                </div>
                {myOrgs.length > 1 && (
                  <div className="border-b border-line p-2 md:hidden">
                    <label className="label text-xs" htmlFor="org-m">Escritório</label>
                    <select id="org-m" className="field text-sm" value={org.id} onChange={(e) => switchOrg(e.target.value)}>
                      {myOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                )}
                <Link href="/app/configuracoes" className="flex min-h-10 items-center rounded px-3 text-sm hover:bg-surface-muted">Preferências e aparência</Link>
                <Link href="/demonstracao" className="flex min-h-10 items-center rounded px-3 text-sm hover:bg-surface-muted">Trocar perfil de demonstração</Link>
                <button onClick={signOut} className="flex min-h-10 w-full items-center gap-2 rounded px-3 text-left text-sm text-danger hover:bg-danger-bg">
                  <LogOut aria-hidden className="size-4" /> Sair
                </button>
              </div>
            </details>
          </div>
        </header>

        <main id="conteudo" tabIndex={-1} className="min-w-0 flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+88px)] pt-5 outline-none sm:px-6 sm:pb-10 lg:px-8">
          {children}
        </main>
      </div>

      {/* Barra inferior (< 600px) */}
      <nav aria-label="Navegação rápida" className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        {MOBILE_TABS.filter((t) => can(user.role, t.area)).slice(0, 2).map((t) => <TabLink key={t.href} {...t} active={isActive(t.href)} />)}
        <button onClick={() => setPaletteOpen(true)} className="flex flex-col items-center justify-center" aria-label="Novo ou buscar">
          <span className="-mt-5 inline-flex size-12 items-center justify-center rounded-full bg-brand text-on-brand shadow-lg ring-4 ring-canvas">
            <Plus aria-hidden className="size-5" />
          </span>
        </button>
        {MOBILE_TABS.filter((t) => can(user.role, t.area)).slice(2).map((t) => <TabLink key={t.href} {...t} active={isActive(t.href)} />)}
        <button onClick={() => setMoreOpen(true)} className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.7rem] text-fg-muted">
          <MORE_ICON aria-hidden className="size-5" /> Mais
        </button>
      </nav>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="Mais">
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-fg-muted">{g.label}</p>
              <div className="space-y-0.5" onClick={() => setMoreOpen(false)}>{g.items.map((i) => navLink(i, "full"))}</div>
            </div>
          ))}
        </div>
      </Dialog>

      {paletteOpen && <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}

function TabLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ElementType; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.7rem] ${active ? "text-brand" : "text-fg-muted"}`}>
      <Icon aria-hidden className="size-5" />
      {label}
    </Link>
  );
}
