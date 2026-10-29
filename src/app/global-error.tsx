"use client";

import { useEffect } from "react";

// Último recurso quando o layout raiz falha. No Safari, um fetch do App Router interrompido por uma navegação rápida
// ("access control checks") chegava aqui e mostrava a tela genérica do Next, em inglês e sem `lang`.
// Falha de rede tenta de novo sozinha uma vez; o resto mostra a mensagem com botão. Nenhum detalhe técnico na tela.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const network = /fetch|network|load failed|access control/i.test(String((error as Error)?.message ?? error));
  useEffect(() => {
    if (!network) return;
    const k = "lexsion.ge-retry";
    try {
      if (sessionStorage.getItem(k) === location.pathname) return; // só uma vez por página (evita laço)
      sessionStorage.setItem(k, location.pathname);
    } catch {}
    retry();
  }, [network, retry]);
  return (
    <html lang="pt-BR" data-theme="dark">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#0b0d12", color: "#f2f2f2", font: "16px/1.5 system-ui, sans-serif", padding: "1.25rem" }}>
        <main style={{ maxWidth: "26rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 .5rem" }}>{network ? "A conexão oscilou" : "Algo deu errado"}</h1>
          <p style={{ margin: "0 0 1.25rem", color: "#c9ccd3" }}>{network ? "Não conseguimos carregar esta tela agora. Seus dados estão preservados." : "Esta tela não pôde ser exibida. Nada do que você salvou foi perdido."}</p>
          <button onClick={() => retry()} style={{ minHeight: 44, padding: "0 1.25rem", borderRadius: 8, border: 0, background: "#d4af37", color: "#111", fontWeight: 600, cursor: "pointer" }}>Tentar de novo</button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- layout raiz falhou: recarga completa, não navegação do App Router */}
          <p style={{ marginTop: "1rem" }}><a href="/" style={{ color: "#e7cf7a" }}>Voltar ao início</a></p>
        </main>
      </body>
    </html>
  );
}
