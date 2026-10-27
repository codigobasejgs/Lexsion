"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, FlaskConical } from "lucide-react";
import { useSession } from "@/components/providers";
import { organizations, users } from "@/mocks/fixtures";
import { ROLE_LABEL } from "@/domain/permissions";

export default function EntrarPage() {
  const { signIn } = useSession();
  const router = useRouter();
  const [userId, setUserId] = useState("u-rafael");
  const selected = users.find((u) => u.id === userId)!;

  const enter = () => {
    signIn(userId);
    router.push(selected.role === "cliente" ? "/portal" : selected.role === "superadmin" ? "/admin/organizacoes" : "/app/inicio");
  };

  return (
    <main id="conteudo" className="grid min-h-dvh grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Painel de marca: textura/gradiente só aqui, nunca sob dados. */}
      <section className="relative hidden overflow-hidden bg-[radial-gradient(120%_80%_at_20%_10%,#2a2014_0%,#0d0b08_55%,#060504_100%)] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="absolute inset-0 opacity-[0.07] [background-image:repeating-linear-gradient(45deg,#f1d397_0_1px,transparent_1px_7px)]" />
        <div className="relative flex items-center gap-3">
          <span aria-hidden className="inline-flex size-11 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#f1d397,#d6ae62_55%,#9c7230)] font-serif text-lg font-bold italic text-[#171108]">SW</span>
          <span className="text-lg font-semibold tracking-[0.25em] text-[#f7f1e6]">SIWILTEC</span>
        </div>
        <div className="relative max-w-lg">
          <p className="text-sm font-medium tracking-[0.3em] text-[#d6ae62]">GESTÃO INTELIGENTE DE ESCRITÓRIOS</p>
          <h1 className="mt-4 font-serif text-4xl leading-tight text-[#f7f1e6]">O escritório inteiro, do primeiro contato ao recebimento — na palma da mão.</h1>
          <p className="mt-4 text-[#c4b8a5]">Atendimento, casos, documentos, prazos e financeiro conectados, com a assistente virtual sempre sob controle da equipe.</p>
        </div>
        <p className="relative text-sm text-[#c4b8a5]">Simplificando o seu dia a dia.</p>
      </section>

      <section className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span aria-hidden className="inline-flex size-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#f1d397,#d6ae62_55%,#9c7230)] font-serif font-bold italic text-[#171108]">SW</span>
            <span className="font-semibold tracking-[0.22em]">SIWILTEC</span>
          </div>
          <h2 className="text-2xl font-semibold">Entrar na demonstração</h2>
          <p className="mt-1 text-fg-muted">Escolha um perfil fictício. Cada perfil vê apenas o que lhe é permitido.</p>

          <div className="mt-4 flex items-start gap-2 rounded-[var(--radius-control)] border border-dashed border-accent/50 p-3 text-sm text-accent">
            <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0" />
            Ambiente demonstrativo — dados fictícios. Não há senha nem conta real; nenhum dado sai deste navegador.
          </div>

          {/* fieldset tem min-inline-size: min-content por padrão — min-w-0 evita estourar 360px */}
          <fieldset className="mt-6 min-w-0 space-y-2">
            <legend className="label">Perfil de demonstração</legend>
            {users.map((u) => {
              const org = organizations.find((o) => o.id === u.organizationId);
              return (
                <label key={u.id} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border px-3 py-2 transition-colors ${userId === u.id ? "border-brand bg-selection" : "border-line bg-surface hover:border-line-strong"}`}>
                  <input type="radio" name="perfil" value={u.id} checked={userId === u.id} onChange={() => setUserId(u.id)} className="size-4 accent-[var(--brand)]" />
                  <span className="min-w-0">
                    <span className="block font-medium">{ROLE_LABEL[u.role]}</span>
                    <span className="block truncate text-sm text-fg-muted">{u.name}{org ? ` · ${org.name}` : " · Plataforma"}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <button className="btn btn-primary mt-6 min-h-12 w-full py-2 text-base" onClick={enter}>
            Entrar como {ROLE_LABEL[selected.role]} <ArrowRight aria-hidden className="size-4" />
          </button>
          <p className="mt-3 text-center text-sm"><Link className="text-accent underline underline-offset-2" href="/recuperar-acesso">Esqueci meu acesso</Link></p>
          <p className="mt-3 text-center text-xs text-fg-muted">Autorização desta demo é apenas visual; em produção, exigirá autenticação e controle no servidor.</p>
        </div>
      </section>
    </main>
  );
}
