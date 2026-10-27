import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteShell } from "@/components/marketing/site-shell";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: { absolute: "Contato e apresentação — LexSion" },
  description: "Solicite uma apresentação da LexSion para o seu escritório.",
  alternates: { canonical: "/contato" }, robots: { index: true, follow: true },
};

export default function ContatoPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-2xl px-5 py-12">
        <h1 className="text-3xl font-semibold sm:text-4xl">Solicitar apresentação</h1>
        <p className="mt-3 text-fg-muted">Conte um pouco sobre o seu escritório e mostramos a LexSion com a sua rotina.</p>
        <Suspense><ContactForm /></Suspense>
      </section>
    </SiteShell>
  );
}
