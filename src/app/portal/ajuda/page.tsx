"use client";

import { useState } from "react";
import { useCollection, useSession } from "@/components/providers";
import { Feedback, useAction } from "@/modules/shared";
import { createRow } from "@/services/mock/generic";
import { portalAsk } from "@/services/real/backend";
import { useTour } from "@/tours/runner";

const FAQ = [
  ["Como envio um documento?", "Abra “Documentos”, toque em “Enviar foto ou arquivo” no pedido e escolha a foto ou o PDF."],
  ["O status do meu caso é uma garantia?", "Não. O status mostra em que etapa estamos. O resultado depende da análise do INSS ou da Justiça."],
  ["Posso pagar por aqui?", "Ainda não. Em “Pagamentos” você vê as parcelas; o pagamento online será habilitado quando o escritório ativar a cobrança."],
  ["Quem pode ver meus documentos?", "Somente a equipe do escritório responsável pelo seu caso."],
  ["Como instalo o aplicativo no celular?", "No iPhone: Safari → Compartilhar → Adicionar à Tela de Início. No Android: menu do Chrome → Instalar aplicativo."],
];

export default function PortalAjudaPage() {
  const { user, mode } = useSession();
  const cases = useCollection("cases");
  const act = useAction("tasks");
  const [q, setQ] = useState("");
  const tour = useTour();
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-2xl">Ajuda</h1>
      <button className="btn btn-secondary min-h-12 w-full" onClick={() => tour.start("portal")}>Fazer o tour da área do cliente</button>
      <section className="panel divide-y divide-line">
        {FAQ.map(([qq, a]) => <details key={qq} className="p-4"><summary className="cursor-pointer font-medium">{qq}</summary><p className="mt-2 text-fg-muted">{a}</p></details>)}
      </section>
      <section className="panel space-y-3 p-5">
        <h2 className="font-medium">Enviar uma dúvida à equipe</h2>
        <label className="block"><span className="sr-only">Sua dúvida</span><textarea rows={3} className="field py-2" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escreva sua dúvida" /></label>
        <Feedback error={act.error} notice={act.notice} />
        <button className="btn btn-primary min-h-12 w-full" disabled={q.trim().length < 5 || act.pending} onClick={async () => {
          const k = cases.data?.find((x) => x.clientId === user?.clientId);
          if (mode === "real") {
            const sent = await act.run(async () => {
              try { await portalAsk(q.trim()); return { ok: true as const, data: true, correlationId: "" }; }
              catch (e) { return { ok: false as const, error: { code: "ask", message: (e as Error).message, retryable: true }, correlationId: "" }; }
            }, "Dúvida enviada. A equipe responde pelo canal combinado com o escritório.");
            if (sent) setQ("");
            return;
          }
          if (await act.run((ctx) => createRow("tasks", { title: `Dúvida do cliente (portal): ${q.trim().slice(0, 80)}`, clientId: user?.clientId, caseId: k?.id, assigneeId: k?.ownerId ?? "u-bia", due: "2026-10-27", priority: "normal", done: false, comments: [{ at: new Date().toISOString(), actorId: ctx.actorId, text: q.trim() }] }, ctx, "Dúvida enviada pelo portal"), "Dúvida enviada. A equipe responde pelo WhatsApp (simulação).")) setQ("");
        }}>Enviar dúvida</button>
      </section>
    </div>
  );
}
