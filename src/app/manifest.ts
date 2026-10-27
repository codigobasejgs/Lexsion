import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app/inicio",
    name: "SIWILTEC — Gestão Inteligente de Escritórios",
    short_name: "SIWILTEC",
    description: "Atendimento, clientes, casos, documentos, agenda e financeiro do escritório em um só lugar. Ambiente demonstrativo.",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/app/inicio?origem=pwa", // nunca token/cliente/organização na URL
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#090807",
    theme_color: "#090807",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/monochrome-512.png", sizes: "512x512", type: "image/png", purpose: "monochrome" },
    ],
    shortcuts: [
      { name: "Meu dia", url: "/app/inicio", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Atendimento", url: "/app/atendimento", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Agenda", url: "/app/agenda", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
