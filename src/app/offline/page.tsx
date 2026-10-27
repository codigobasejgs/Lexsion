import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Sem conexão" };

// Página pública e neutra (sem dados de sessão) — precacheada pelo service worker.
export default function OfflinePage() {
  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-6 py-12">
      <p className="text-sm font-medium tracking-[0.2em] text-accent">LexSion</p>
      <h1 className="text-2xl font-semibold">Você está sem conexão</h1>
      <p className="text-fg-muted">
        Esta página ainda não foi aberta neste dispositivo, por isso não está disponível offline.
        As telas que você já visitou e os dados da demonstração guardados neste aparelho continuam acessíveis.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-fg-muted">
        <li>Mensagens, cobranças e assinaturas reais nunca são enviadas sem conexão.</li>
        <li>Quando a internet voltar, tente novamente.</li>
      </ul>
      <div className="flex flex-wrap gap-2">
        <a href="" className="btn btn-primary">Tentar novamente</a>
        <Link href="/app/inicio" className="btn btn-secondary">Ir para Meu dia</Link>
      </div>
    </main>
  );
}
