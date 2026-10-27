// Caches de HTML de shell do service worker (legado "siwiltec-shell-*" e por contexto "siwiltec-<ctx>-shell-*").
// Estáticos versionados ("siwiltec-static-*") não contêm dados de sessão e ficam.
export const isShellCache = (k: string) => /^siwiltec-(.+-)?shell-/.test(k);
