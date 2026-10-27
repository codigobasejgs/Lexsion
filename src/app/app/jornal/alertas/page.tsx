"use client";

import { useEffect, useState } from "react";
import { Guard } from "@/components/guard";
import { PageHeader, SimulatedBadge } from "@/components/ui";
import { readNewsPrefs, writeNewsPrefs } from "@/modules/news/labels";
import { ALL_AREAS } from "@/domain/areas";

export default function AlertasPage() {
  const [topics, setTopics] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preferência local
    setTopics(readNewsPrefs().topics);
  }, []);
  return (
    <Guard area="jornal">
      <div className="mx-auto max-w-[900px]">
        <PageHeader breadcrumb={[{ href: "/app/jornal", label: "Jornal" }]} title="Alertas e newsletter" description="Escolha temas para acompanhar. Envio por e-mail (Resend) é simulado nesta fase." actions={<SimulatedBadge />} />
        <fieldset className="panel p-4"><legend className="sr-only">Temas</legend>
          <div className="grid gap-2 sm:grid-cols-3">{ALL_AREAS.map((a) => <label key={a} className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={topics.includes(a)} onChange={(e) => { setSaved(false); setTopics(e.target.checked ? [...topics, a] : topics.filter((x) => x !== a)); }} />{a}</label>)}</div>
        </fieldset>
        <button className="btn btn-primary mt-4" onClick={() => { writeNewsPrefs({ ...readNewsPrefs(), topics }); setSaved(true); }}>Salvar temas</button>
        <p role="status" className="mt-2 text-sm text-success">{saved ? `Acompanhando ${topics.length} tema(s). Newsletter semanal simulada — nenhum e-mail é enviado.` : ""}</p>
      </div>
    </Guard>
  );
}
