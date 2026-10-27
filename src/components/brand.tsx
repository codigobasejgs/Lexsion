// Marca-mãe LexSion: sempre o vetor ORIGINAL (public/brand/lexsion), nunca texto CSS imitando o logotipo.
/* eslint-disable @next/next/no-img-element -- SVG estático da marca; next/image não otimiza SVG */

export function LexSionLogo({ className = "h-8", variant = "auto" }: { className?: string; variant?: "auto" | "dark" | "light" }) {
  const alt = "LexSion — Plataforma Jurídica Inteligente";
  if (variant === "dark") return <img src="/brand/lexsion/lexsion-logo-horizontal-transparente.svg" alt={alt} className={`${className} w-auto`} />;
  if (variant === "light") return <img src="/brand/lexsion/lexsion-logo-light.svg" alt={alt} className={`${className} w-auto`} />;
  // Tema escuro: versão transparente (letras claras); tema claro: versão para fundo claro.
  return (
    <>
      <img src="/brand/lexsion/lexsion-logo-horizontal-transparente.svg" alt={alt} className={`${className} w-auto [:root[data-theme=light]_&]:hidden`} />
      <img src="/brand/lexsion/lexsion-logo-light.svg" alt={alt} className={`${className} hidden w-auto [:root[data-theme=light]_&]:block`} />
    </>
  );
}

export function LexSionEmblem({ className = "size-8" }: { className?: string }) {
  return <img src="/brand/lexsion/lexsion-emblema-transparente.svg" alt="" aria-hidden className={className} />;
}

/** Logotipo do escritório (white-label) com alternativa por iniciais. */
export function TenantLogo({ src, name, className = "size-8" }: { src?: string; name: string; className?: string }) {
  if (src) return <img src={src} alt={`Logotipo de ${name}`} className={`${className} rounded-lg object-contain`} />;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return <span aria-hidden className={`${className} inline-flex items-center justify-center rounded-lg bg-brand text-sm font-semibold text-on-brand`}>{initials}</span>;
}
