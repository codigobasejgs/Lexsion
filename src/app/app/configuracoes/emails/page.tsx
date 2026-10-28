"use client";

import { useMemo, useState } from "react";
import { Info, Send } from "lucide-react";
import { Guard } from "@/components/guard";
import { useSession } from "@/components/providers";
import { PageHeader } from "@/components/ui";
import { TEMPLATES, renderEmail, type TemplateId } from "@/domain/email-templates";
import { emailAdapter } from "@/services/adapters";
import { useLive } from "@/modules/shared";

const SAMPLE: Record<string, string> = { nome: "Maria das Graças Exemplo", documento: "comprovante de residência", caso: "BPC/LOAS — pessoa idosa", valor: "R$ 150,00", vencimento: "10/11/2026" };

// Prévia dos e-mails com a marca do escritório. Envio real depende do backend (Resend + domínio verificado).
export default function EmailsPage() {
  const live = useLive();
  const { tenant } = useSession();
  const [id, setId] = useState<TemplateId>("documento-pendente");
  const [notice, setNotice] = useState<string | null>(null);
  const r = useMemo(() => (tenant ? renderEmail(id, SAMPLE, tenant.settings) : null), [id, tenant]);
  if (!tenant || !r) return null;
  return (
    <Guard area="configuracoes">
      <div className="mx-auto max-w-5xl">
        <PageHeader breadcrumb={[{ href: "/app/configuracoes", label: "Configurações" }]} title="Modelos de e-mail" description={`Avisos enviados aos clientes e à equipe com a marca de ${tenant.settings.brandName}. Prévia com dados fictícios.`} />
        <p className="mb-4 flex items-start gap-2 rounded-[var(--radius-control)] border border-info/30 bg-info-bg p-3 text-sm text-info"><Info aria-hidden className="mt-0.5 size-4 shrink-0" /> Envio real ainda não está ativo: depende do provedor de e-mail e da verificação do domínio remetente. Nada é enviado nesta tela.</p>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <nav aria-label="Modelos" className="space-y-1">
            {TEMPLATES.map((t) => <button key={t.id} aria-current={id === t.id ? "true" : undefined} onClick={() => { setId(t.id); setNotice(null); }} className={`flex min-h-11 w-full items-center rounded-[var(--radius-control)] px-3 text-left text-sm ${id === t.id ? "bg-selection font-medium" : "text-fg-muted hover:bg-surface-muted"}`}>{t.label}</button>)}
          </nav>
          <section aria-label="Prévia do e-mail" className="space-y-3">
            <p className="text-sm"><span className="text-fg-muted">Assunto:</span> <strong data-testid="assunto" dangerouslySetInnerHTML={{ __html: r.subject }} /></p>
            {/* sandbox sem scripts: a prévia não executa nada do HTML */}
            <iframe title="Prévia do e-mail" sandbox="" srcDoc={r.html} className="h-[560px] w-full rounded-[var(--radius-panel)] border border-line bg-white" />
            {!live && <button className="btn btn-secondary" onClick={async () => { const s = await emailAdapter.send({ to: "teste@exemplo.test", subject: r.subject, html: r.html, organizationId: tenant.id }); setNotice(s.ok ? "Envio simulado — nenhum e-mail real foi enviado." : s.error.message); }}><Send aria-hidden className="size-4" /> Enviar teste (simulado)</button>}
            <p role="status" aria-live="polite" className="text-sm text-accent">{notice}</p>
          </section>
        </div>
      </div>
    </Guard>
  );
}
