"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FileText, FlaskConical, HelpCircle, Home, LogOut, Wallet } from "lucide-react";
import { lastWasDemo, useSession } from "@/components/providers";
import { TenantLogo } from "@/components/brand";

const TABS = [
  ["/portal", "Início", Home],
  ["/portal/documentos", "Documentos", FileText],
  ["/portal/pagamentos", "Pagamentos", Wallet],
  ["/portal/ajuda", "Ajuda", HelpCircle],
] as const;

// Portal do cliente: navegação curta, linguagem leiga, sem dados internos.
export default function PortalLayout({ children }: LayoutProps<"/portal">) {
  const { ready, mode, user, org, tenant, signOut } = useSession();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (ready && (!user || user.role !== "cliente")) router.replace(mode === "real" || (!user && !lastWasDemo()) ? "/entrar" : "/demonstracao");
  }, [ready, mode, user, router]);
  if (!ready || !user || user.role !== "cliente") return <div className="min-h-dvh bg-canvas" />;
  return (
    <div className="min-h-dvh pb-[calc(env(safe-area-inset-bottom)+72px)] sm:pb-0">
      {mode === "demo" && <div className="flex items-center justify-center gap-2 bg-ai-bg px-4 py-1 text-xs text-ai"><FlaskConical aria-hidden className="size-3.5" /> Ambiente demonstrativo — dados fictícios</div>}
      <header className="border-b border-line bg-surface px-5 pb-3 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <TenantLogo src={tenant?.settings.logoLight} name={tenant?.settings.brandName ?? org?.name ?? ""} className="size-9 shrink-0" />
          <div className="min-w-0 flex-1"><p className="truncate font-medium">{tenant?.settings.brandName ?? org?.name}</p><p className="text-xs text-fg-muted">Área do cliente</p></div>
          <button className="btn btn-ghost" onClick={signOut}><LogOut aria-hidden className="size-4" /> Sair</button>
        </div>
        <nav aria-label="Portal" className="mx-auto mt-3 hidden max-w-2xl gap-1 sm:flex">
          {TABS.map(([href, label]) => <Link key={href} href={href} aria-current={path === href ? "page" : undefined} className={`rounded-full px-4 py-2 text-sm ${path === href ? "bg-selection font-medium" : "text-fg-muted hover:text-fg"}`}>{label}</Link>)}
        </nav>
      </header>
      <main id="conteudo" className="mx-auto max-w-2xl px-5 py-6 text-[1.05rem]">{children}{tenant?.settings.showPoweredBy && <p className="mt-10 text-center text-xs text-fg-muted">Tecnologia LexSion</p>}</main>
      <nav aria-label="Portal" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        {TABS.map(([href, label, Icon]) => <Link key={href} href={href} aria-current={path === href ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${path === href ? "text-brand" : "text-fg-muted"}`}><Icon aria-hidden className="size-5" />{label}</Link>)}
      </nav>
    </div>
  );
}
