"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, ChevronRight, MessageCircle, Wallet } from "lucide-react";
import { useSession } from "@/components/providers";
import { LoadingBlock } from "@/components/ui";
import { usePortalData } from "@/modules/portal/data";
import { civilFromInstant, formatCivil, formatCivilLong, formatTime } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { simplify } from "@/domain/plain-language";

export default function PortalPage() {
  const { user, tenant } = useSession();
  const d = usePortalData();
  const plain = tenant?.settings.simpleLanguage ? simplify : (s: string) => s;
  const [notice, setNotice] = useState<string | null>(null);
  const first = user?.name.split(" ")[0];
  const nextBill = d.bills[0];
  if (d.loading) return <LoadingBlock rows={3} />;
  return (
    <div className="space-y-5" data-tour="portal-inicio">
      <div><h1 className="font-serif text-3xl">Olá, {first}</h1><p className="mt-1 text-fg-muted">Aqui você acompanha seu caso de forma simples.</p></div>

      {d.cases.map((k) => (
        <Link key={k.id} href={`/portal/casos/${k.id}`} className="panel block p-5 hover:border-line-strong">
          <h2 className="text-sm font-medium uppercase tracking-wider text-accent">Em que pé está meu caso?</h2>
          <p className="mt-2 font-serif text-xl">{k.title}</p>
          <p className="mt-2">{plain(k.portalStatus)}</p>
          <div className="mt-4 rounded-[var(--radius-control)] border border-brand/40 bg-selection p-3"><p className="text-sm text-fg-muted">Próximo passo</p><p className="font-medium">{plain(k.portalNextStep)}</p></div>
          <p className="mt-3 flex items-center justify-between text-sm text-fg-muted">Status informativo. Não representa garantia de resultado. <ChevronRight aria-hidden className="size-4" /></p>
        </Link>
      ))}

      <section className="panel p-5" aria-labelledby="docs-t" data-tour="portal-docs">
        <h2 id="docs-t" className="text-sm font-medium uppercase tracking-wider text-accent">O que preciso enviar?</h2>
        {d.docsNeeded.length ? <><ul className="mt-2 list-disc pl-5">{d.docsNeeded.map((x) => <li key={x.id}>{x.name}</li>)}</ul><Link href="/portal/documentos" className="btn btn-primary mt-3 min-h-12 w-full">Enviar documentos</Link></> : <p className="mt-2">Nenhum documento pendente. Obrigado!</p>}
      </section>

      <section className="panel p-5" aria-labelledby="ag-t">
        <h2 id="ag-t" className="text-sm font-medium uppercase tracking-wider text-accent">Quando é meu próximo compromisso?</h2>
        {d.events.length ? d.events.slice(0, 2).map((e) => (
          <div key={e.id} className="mt-3 flex gap-3"><CalendarDays aria-hidden className="mt-1 size-5 shrink-0 text-accent" /><div><p className="font-medium">{e.title}</p><p className="text-fg-muted">{formatCivilLong(civilFromInstant(e.start))}, às {formatTime(e.start)}</p><p className="text-fg-muted">{e.location}</p>{!!e.requiredDocs?.length && <p className="text-sm">Levar: {e.requiredDocs.join(", ")}</p>}</div></div>
        )) : <p className="mt-2">Nenhum compromisso marcado.</p>}
      </section>

      <section className="panel p-5" aria-labelledby="pg-t" data-tour="portal-pagar">
        <h2 id="pg-t" className="text-sm font-medium uppercase tracking-wider text-accent">O que devo pagar?</h2>
        {nextBill ? <div className="mt-3 flex gap-3"><Wallet aria-hidden className="mt-1 size-5 shrink-0 text-accent" /><div><p className="num text-2xl font-semibold">{formatBRL(nextBill.amount - nextBill.paid)}</p><p className="text-fg-muted">{nextBill.label} · vence em {formatCivil(nextBill.due)}</p><Link href="/portal/pagamentos" className="mt-2 inline-block text-accent underline underline-offset-2">Ver todos os pagamentos</Link></div></div> : <p className="mt-2">Você não tem valores em aberto.</p>}
      </section>

      <button onClick={() => setNotice("Demonstração: em produção, este botão abre a conversa com o escritório no WhatsApp.")} className="btn btn-secondary min-h-12 w-full text-base"><MessageCircle aria-hidden className="size-5" /> Falar com o escritório</button>
      <p role="status" aria-live="polite" className={notice ? "rounded-[var(--radius-control)] border border-dashed border-accent/60 p-3 text-sm text-accent" : "sr-only"}>{notice}</p>
    </div>
  );
}
