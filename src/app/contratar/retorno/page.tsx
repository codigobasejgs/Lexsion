"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { SiteShell } from "@/components/marketing/site-shell";

// Volta do checkout. Os parâmetros da URL são só pistas: o servidor confere no /payment_check antes de qualquer coisa.
const TEXT: Record<string, { icon: typeof Clock; title: string; text: string }> = {
  ativo: { icon: CheckCircle2, title: "Pagamento confirmado e escritório ativo", text: "Enviamos o acesso para o e-mail do(a) titular. Abra o e-mail para criar a senha e entrar." },
  ativando: { icon: Loader2, title: "Pagamento confirmado", text: "Estamos preparando o escritório. Isso leva alguns instantes." },
  ativacao_pendente: { icon: Clock, title: "Pagamento confirmado", text: "A criação do escritório está pendente e será concluída pela equipe LexSion. Você não será cobrado(a) de novo." },
  pendente: { icon: Clock, title: "Aguardando confirmação do pagamento", text: "Assim que a InfinitePay confirmar, o escritório é criado e você recebe o acesso por e-mail." },
  verificando: { icon: Clock, title: "Verificando o pagamento", text: "Não foi possível confirmar com a InfinitePay agora. Se o pagamento foi feito, ele será confirmado automaticamente." },
  expirado: { icon: XCircle, title: "Pedido expirado", text: "O prazo para pagamento terminou. Nada foi cobrado. Faça um novo cadastro." },
  cancelado: { icon: XCircle, title: "Pedido cancelado", text: "Nada foi cobrado." },
  estornado: { icon: XCircle, title: "Pagamento estornado", text: "O valor foi devolvido pela InfinitePay." },
  desconhecido: { icon: XCircle, title: "Pedido não encontrado", text: "Confira o link ou fale com a LexSion pelo contato." },
};

export default function RetornoPage() {
  const [state, setState] = useState<string>("carregando");
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const body = JSON.stringify({ order_nsu: q.get("order_nsu"), transaction_nsu: q.get("transaction_nsu"), slug: q.get("slug"), capture_method: q.get("capture_method") });
    let n = 0, stop = false;
    const tick = async () => {
      const r = await fetch("/api/contratar/status", { method: "POST", headers: { "Content-Type": "application/json" }, body }).then((x) => x.json()).catch(() => ({ state: "verificando" }));
      if (stop) return;
      setState(r.state ?? "desconhecido");
      if (["ativando", "pendente", "verificando"].includes(r.state) && ++n < 10) setTimeout(tick, 4000);
    };
    void tick();
    return () => { stop = true; };
  }, []);
  const t = TEXT[state];
  return (
    <SiteShell>
      <section className="mx-auto max-w-xl px-5 py-16 text-center" aria-live="polite">
        {!t ? <p className="text-fg-muted"><Loader2 aria-hidden className="mx-auto size-6 animate-spin" /> Conferindo o pagamento…</p> : (
          <div role="status">
            <t.icon aria-hidden className={`mx-auto size-10 ${state === "ativo" ? "text-success" : state.match(/expirado|cancelado|estornado|desconhecido/) ? "text-danger" : "text-info"} ${state === "ativando" ? "animate-spin" : ""}`} />
            <h1 className="mt-4 text-2xl font-semibold">{t.title}</h1>
            <p className="mt-2 text-fg-muted">{t.text}</p>
            <div className="mt-6 flex justify-center gap-2">{state === "ativo" ? <Link href="/entrar" className="btn btn-primary">Entrar</Link> : <Link href="/planos" className="btn btn-secondary">Ver planos</Link>}</div>
          </div>
        )}
      </section>
    </SiteShell>
  );
}
