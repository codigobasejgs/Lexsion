"use client";

import { useMemo } from "react";
import { useCollection, useSession } from "@/components/providers";
import { civilFromInstant } from "@/lib/dates";
import { DEMO_TODAY } from "@/mocks/clock";

/** Só dados liberados ao cliente logado (filtro demonstrativo; produção exige RLS). */
export function usePortalData() {
  const { user } = useSession();
  const cases = useCollection("cases");
  const docs = useCollection("documents");
  const events = useCollection("events");
  const insts = useCollection("installments");
  const charges = useCollection("charges");
  const cid = user?.clientId;
  return useMemo(() => ({
    loading: cases.isPending,
    cases: (cases.data ?? []).filter((k) => k.clientId === cid),
    docsNeeded: (docs.data ?? []).filter((d) => d.clientId === cid && d.status === "solicitado"),
    docsShared: (docs.data ?? []).filter((d) => d.clientId === cid && d.sharedWithClient && d.status !== "solicitado"),
    docsSent: (docs.data ?? []).filter((d) => d.clientId === cid && d.origin === "portal"),
    events: (events.data ?? []).filter((e) => e.clientId === cid && e.visibleToClient && civilFromInstant(e.start) >= DEMO_TODAY).sort((a, b) => a.start.localeCompare(b.start)),
    bills: (insts.data ?? []).filter((i) => i.clientId === cid && (i.status === "aberta" || i.status === "parcial")).sort((a, b) => a.due.localeCompare(b.due)),
    paid: (insts.data ?? []).filter((i) => i.clientId === cid && i.status === "paga"),
    charges: (charges.data ?? []).filter((c) => (insts.data ?? []).some((i) => i.id === c.installmentId && i.clientId === cid)),
  }), [cases.isPending, cases.data, docs.data, events.data, insts.data, charges.data, cid]);
}
