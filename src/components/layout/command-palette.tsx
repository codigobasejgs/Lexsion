"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Briefcase, CalendarDays, KanbanSquare, MessagesSquare, Plus, Search, Target, User } from "lucide-react";
import { Dialog } from "@/components/ui";
import { useCollection, useSession } from "@/components/providers";
import { can } from "@/domain/permissions";
import { HELP_ARTICLES } from "@/content/help";

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  href: string;
  icon: React.ElementType;
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Busca global (Ctrl/⌘+K) respeitando permissões do perfil. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { user } = useSession();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const clients = useCollection("clients");
  const cases = useCollection("cases");
  const convs = useCollection("conversations");
  const leads = useCollection("leads");

  const items = useMemo<Item[]>(() => {
    if (!user) return [];
    const r = user.role;
    const out: Item[] = [
      { id: "a-conv", group: "Ações", label: "Ir para Conversas", href: "/app/atendimento", icon: MessagesSquare },
      { id: "a-agenda", group: "Ações", label: "Ver agenda", href: "/app/agenda", icon: CalendarDays },
      { id: "a-cliente", group: "Ações", label: "Novo cliente", href: "/app/clientes/novo", icon: Plus },
      { id: "a-lead", group: "Ações", label: "Novo lead", href: "/app/crm?novo=1", icon: Plus },
      { id: "a-crm", group: "Ações", label: "Ir para o funil (CRM)", href: "/app/crm", icon: KanbanSquare },
    ].filter((i) => (i.href.includes("atendimento") ? can(r, "atendimento") : i.href.includes("agenda") ? can(r, "agenda") : i.href.includes("crm") ? can(r, "crm") : can(r, "clientes")));
    if (can(r, "clientes")) for (const c of clients.data ?? []) out.push({ id: c.id, group: "Clientes", label: c.name, hint: c.city, href: `/app/clientes/${c.id}`, icon: User });
    if (can(r, "casos")) for (const k of cases.data ?? []) out.push({ id: k.id, group: "Casos", label: k.title, hint: k.processNumber ?? k.area, href: `/app/casos/${k.id}`, icon: Briefcase });
    if (can(r, "atendimento")) for (const c of convs.data ?? []) out.push({ id: c.id, group: "Conversas", label: c.contactName, hint: c.summary.slice(0, 60), href: `/app/atendimento/${c.id}`, icon: MessagesSquare });
    if (can(r, "crm")) for (const l of leads.data ?? []) if (!l.clientId) out.push({ id: l.id, group: "Leads", label: l.name, hint: l.service, href: `/app/crm/leads/${l.id}`, icon: Target });
    for (const a of HELP_ARTICLES) out.push({ id: a.slug, group: "Ajuda", label: a.title, href: `/app/ajuda/${a.slug}`, icon: BookOpen });
    return out;
  }, [user, clients.data, cases.data, convs.data, leads.data]);

  const results = useMemo(() => {
    const n = norm(q.trim());
    const list = n ? items.filter((i) => norm(`${i.label} ${i.hint ?? ""}`).includes(n)) : items.filter((i) => i.group === "Ações" || i.group === "Ajuda").slice(0, 8);
    return list.slice(0, 30);
  }, [q, items]);

  const go = (it: Item) => {
    onClose();
    setQ("");
    router.push(it.href);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[idx]) {
      e.preventDefault();
      go(results[idx]);
    }
  };

  let lastGroup = "";
  return (
    <Dialog open={open} onClose={onClose} title="Buscar ou criar">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls="cmd-list"
          aria-activedescendant={results[idx] ? `cmd-${results[idx].id}` : undefined}
          aria-label="Buscar clientes, casos, conversas e ajuda"
          className="field pl-9"
          placeholder="Digite um nome, caso ou assunto…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(0);
          }}
          onKeyDown={onKey}
          enterKeyHint="go"
        />
      </div>
      <ul id="cmd-list" ref={listRef} role="listbox" aria-label="Resultados" className="mt-3 max-h-[50dvh] overflow-y-auto">
        {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-fg-muted">Nenhum resultado que você possa acessar para “{q}”.</li>}
        {results.map((it, i) => {
          const header = it.group !== lastGroup ? it.group : null;
          lastGroup = it.group;
          const Icon = it.icon;
          return (
            <li key={`${it.group}-${it.id}`} role="presentation">
              {header && <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-[0.12em] text-fg-muted">{header}</p>}
              <div
                id={`cmd-${it.id}`}
                role="option"
                aria-selected={i === idx}
                onMouseEnter={() => setIdx(i)}
                onClick={() => go(it)}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-3 ${i === idx ? "bg-selection text-fg" : "text-fg-muted"}`}
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                <span className="truncate text-fg">{it.label}</span>
                {it.hint && <span className="ml-auto hidden truncate text-xs sm:block">{it.hint}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
