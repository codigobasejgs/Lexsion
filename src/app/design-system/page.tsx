"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge, Dialog, EmptyState, ErrorBlock, LoadingBlock, PageHeader, SimulatedBadge } from "@/components/ui";
import { formatBRL } from "@/lib/money";

// Catálogo executável de tokens e estados (U01). Visível só para admin no menu.
const TOKENS = ["canvas", "surface", "surface-muted", "text-primary", "text-secondary", "border", "brand", "on-brand", "accent", "success", "warning", "danger", "info", "ai"];

export default function DesignSystemPage() {
  const [open, setOpen] = useState(false);
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-8">
        <PageHeader title="Design system" description="SIWILTEC Black & Gold — tokens, componentes e estados. Alterne tema em Configurações para conferir claro/escuro." />

        <section>
          <h2 className="mb-3 font-semibold">Tokens de cor</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {TOKENS.map((t) => (
              <div key={t} className="overflow-hidden rounded-[var(--radius-control)] border border-line">
                <div className="h-14" style={{ background: `var(--${t})` }} />
                <p className="px-2 py-1 font-mono text-xs">--{t}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-semibold">Tipografia</h2>
          <div className="panel space-y-2 p-4">
            <p className="text-[1.75rem] font-semibold">Título de página 28/36</p>
            <p className="text-xl font-semibold">Subtítulo 20/28</p>
            <p>Corpo 16/24 — texto corrido com largura legível.</p>
            <p className="text-sm text-fg-muted">Interface densa 14/20</p>
            <p className="text-xs text-fg-muted">Metadado 12/16</p>
            <p className="num text-right text-lg">{formatBRL(123456789)} · {formatBRL(990)}</p>
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-semibold">Botões</h2>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary">Salvar cliente</button>
            <button className="btn btn-secondary">Secundário</button>
            <button className="btn btn-ghost">Discreto</button>
            <button className="btn btn-danger">Cancelar cobrança</button>
            <button className="btn btn-primary" disabled>Desabilitado</button>
            <button className="btn btn-primary" onClick={() => setOpen(true)}>Abrir diálogo</button>
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-semibold">Status (ícone + texto + cor)</h2>
          <div className="flex flex-wrap gap-2">
            <Badge>Neutro</Badge><Badge tone="success">Pago</Badge><Badge tone="warning">Parcial</Badge><Badge tone="danger">Vencido</Badge>
            <Badge tone="info">Sincronizando</Badge><Badge tone="ai">Gerado por IA</Badge><SimulatedBadge />
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-semibold">Formulário</h2>
          <div className="panel grid gap-4 p-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="ds1">Nome completo</label><input id="ds1" className="field" autoComplete="name" /></div>
            <div><label className="label" htmlFor="ds2">Valor (R$)</label><input id="ds2" className="field num" inputMode="decimal" aria-invalid aria-describedby="ds2e" defaultValue="abc" /><p id="ds2e" className="mt-1 text-sm text-danger">Informe um valor válido, por exemplo 150,00.</p></div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div><h2 className="mb-2 font-semibold">Carregando</h2><LoadingBlock rows={3} /></div>
          <div><h2 className="mb-2 font-semibold">Vazio</h2><EmptyState title="Nada aqui" text="Próxima ação útil explicada." action={<button className="btn btn-secondary">Criar</button>} /></div>
          <div><h2 className="mb-2 font-semibold">Erro</h2><ErrorBlock message="Não foi possível sincronizar. Seu rascunho continua neste dispositivo." retry={() => {}} /></div>
        </section>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Diálogo de exemplo">
        <p>Foco preso no diálogo, Esc fecha, foco volta ao botão de origem.</p>
        <button className="btn btn-primary mt-4" onClick={() => setOpen(false)}>Entendi</button>
      </Dialog>
    </AppShell>
  );
}
