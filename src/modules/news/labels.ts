export const NEWS_KIND = {
  projeto_de_lei: { label: "Projeto de lei", tone: "info" },
  norma_publicada: { label: "Norma publicada", tone: "warning" },
  norma_vigente: { label: "Norma vigente", tone: "success" },
  decisao: { label: "Decisão", tone: "brand" },
  comentario: { label: "Comentário editorial", tone: "neutral" },
} as const;

const KEY = "siwiltec.jornal";
export function readNewsPrefs(): { saved: string[]; topics: string[] } {
  try {
    return { saved: [], topics: [], ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { saved: [], topics: [] };
  }
}
export function writeNewsPrefs(p: { saved: string[]; topics: string[] }) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}
