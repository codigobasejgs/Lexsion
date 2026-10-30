import type { Metadata } from "next";

// A página é client component (sem metadata própria): título fixo aqui para o <title> vir no HTML do servidor.
export const metadata: Metadata = { title: { absolute: "Recuperar acesso — LexSion" }, robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
