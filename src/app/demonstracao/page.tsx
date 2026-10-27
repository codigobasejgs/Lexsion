"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, FlaskConical, Search, ShieldCheck } from "lucide-react";
import { useSession } from "@/components/providers";
import { organizations, users } from "@/mocks/fixtures";
import { isPlatformRole, ROLE_LABEL } from "@/domain/permissions";
import { LexSionLogo } from "@/components/brand";
import type { Role } from "@/domain/types";

// O que cada perfil faz na demonstração (resumo para escolher a jornada certa).
const ROLE_PREVIEW: Record<Role, string> = {
  admin: "Vê tudo do escritório: equipe, identidade visual, financeiro e configurações.",
  advogado: "Casos, prazos, minutas e aprovação de peças e publicações ao cliente.",
  atendimento: "Conversas, funil de leads, triagem e agenda de atendimentos.",
  controladoria: "Prazos, publicações, agenda e tarefas da equipe.",
  financeiro: "Honorários, parcelas, caixa, conciliação e recibos.",
  estagiario: "Apoio em casos, documentos e minutas, sem aprovar.",
  cliente: "Área do cliente: andamento em linguagem simples, documentos e pagamentos.",
  superadmin: "Painel da plataforma LexSion: escritórios, planos e faturas SaaS (fictício).",
  platform_admin: "Opera a plataforma com permissões delegadas: escritórios, planos e faturas. Sem acesso a documentos dos escritórios.",
  platform_support: "Atende chamados dos escritórios. Vê dados agregados; não altera planos nem faturas.",
  tenant_admin: "Gestor(a) operacional: equipe, agenda e rotinas do escritório, sem aprovar peças nem alterar a marca.",
  external_collaborator: "Correspondente ou parceiro: só os casos, documentos e compromissos que lhe forem atribuídos.",
};

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Demonstração interativa: perfis FICTÍCIOS por escritório. Nenhuma conta real, nenhum dado sai do navegador.
export default function DemonstracaoPage() {
  const { signIn } = useSession();
  const router = useRouter();
  const [userId, setUserId] = useState("u-rafael");
  const [q, setQ] = useState("");
  const selected = users.find((u) => u.id === userId)!;

  const groups = useMemo(() => {
    const match = (u: (typeof users)[number]) => !q || norm(`${u.name} ${ROLE_LABEL[u.role]} ${organizations.find((o) => o.id === u.organizationId)?.name ?? "LexSion plataforma"}`).includes(norm(q));
    const offices = organizations.map((o) => ({ id: o.id, title: o.name, subtitle: `${o.city} · ${o.focus}`, people: users.filter((u) => u.organizationId === o.id && match(u)) }));
    const platform = { id: "platform", title: "Plataforma LexSion", subtitle: "Perfil fictício de operação do SaaS", people: users.filter((u) => u.organizationId === null && match(u)) };
    return [...offices, platform].filter((g) => g.people.length);
  }, [q]);

  const enter = () => {
    signIn(userId);
    router.push(selected.role === "cliente" ? "/portal" : isPlatformRole(selected.role) ? "/admin" : "/app/inicio");
  };

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-5 py-3">
          <Link href="/" aria-label="LexSion — voltar ao site"><LexSionLogo className="h-8" /></Link>
          <nav aria-label="Atalhos" className="ml-auto flex flex-wrap gap-1 text-sm">
            <Link href="/" className="btn btn-ghost"><ArrowLeft aria-hidden className="size-4" /> Voltar ao site</Link>
            <Link href="/planos" className="btn btn-ghost">Conhecer os planos</Link>
          </nav>
        </div>
      </header>
      <main id="conteudo" className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="text-3xl font-semibold">Explore a LexSion em uma demonstração interativa</h1>
        <p className="mt-2 max-w-2xl text-fg-muted">Escolha um escritório e uma função. Cada perfil vê apenas o que lhe é permitido, como seria no dia a dia.</p>
        <div className="mt-4 flex max-w-3xl items-start gap-2 rounded-[var(--radius-control)] border border-dashed border-accent/50 p-3 text-sm text-accent">
          <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>Ambiente demonstrativo com dados fictícios. Não há senha nem conta real, e nada sai deste navegador. O que você alterar fica guardado aqui até você reiniciar a demonstração.</span>
        </div>

        <label className="mt-6 flex max-w-md items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-3">
          <Search aria-hidden className="size-4 text-fg-muted" />
          <span className="sr-only">Buscar perfil</span>
          <input type="search" className="min-h-11 w-full bg-transparent outline-none" placeholder="Buscar por função, nome ou escritório" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            {groups.length === 0 && <p className="text-fg-muted">Nenhum perfil encontrado para “{q}”.</p>}
            {groups.map((g) => (
              <fieldset key={g.id} className="min-w-0">
                <legend className="mb-2 flex items-center gap-2 font-semibold">{g.id === "platform" ? <ShieldCheck aria-hidden className="size-4 text-accent" /> : <Building2 aria-hidden className="size-4 text-accent" />}{g.title}<span className="text-sm font-normal text-fg-muted">— {g.subtitle}</span></legend>
                <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
                  {g.people.map((u) => (
                    <label key={u.id} className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border px-3 py-2 transition-colors ${userId === u.id ? "border-brand bg-selection" : "border-line bg-surface hover:border-line-strong"}`}>
                      <input type="radio" name="perfil" value={u.id} checked={userId === u.id} onChange={() => setUserId(u.id)} className="size-4 accent-[var(--brand)]" />
                      <span className="min-w-0">
                        <span className="block font-medium">{ROLE_LABEL[u.role]}</span>
                        <span className="block truncate text-sm text-fg-muted">{u.name}{u.organizationId ? ` · ${organizations.find((o) => o.id === u.organizationId)?.name}` : " · Plataforma"}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          <aside className="panel h-fit space-y-3 p-5 lg:sticky lg:top-6" aria-label="Perfil escolhido">
            <p className="text-sm text-fg-muted">Você vai entrar como</p>
            <p className="text-lg font-semibold">{ROLE_LABEL[selected.role]}</p>
            <p className="text-sm">{selected.name}</p>
            <p className="text-sm text-fg-muted">{ROLE_PREVIEW[selected.role]}</p>
            <button className="btn btn-primary min-h-12 w-full py-2 text-base" onClick={enter}>
              Entrar como {ROLE_LABEL[selected.role]} <ArrowRight aria-hidden className="size-4" />
            </button>
            <p className="text-xs text-fg-muted">Permissões desta demonstração são apenas visuais; na versão em produção, o acesso será controlado no servidor.</p>
          </aside>
        </div>
      </main>
    </div>
  );
}
