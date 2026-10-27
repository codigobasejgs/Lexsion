export default function SuspensaPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-2xl font-semibold">Organização suspensa</h1>
        <p className="text-fg-muted">
          Esta organização foi temporariamente suspensa. Entre em contato com o suporte para reativar.
        </p>
        <a href="/entrar" className="btn btn-secondary inline-flex">
          Voltar ao login
        </a>
      </div>
    </main>
  );
}
