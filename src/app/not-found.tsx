import Link from "next/link";

export default function NotFound() {
  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-medium tracking-[0.2em] text-accent">SIWILTEC</p>
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="text-fg-muted">O endereço pode estar incorreto ou o conteúdo foi movido.</p>
      <Link href="/app/inicio" className="btn btn-primary">Ir para Meu dia</Link>
    </main>
  );
}
