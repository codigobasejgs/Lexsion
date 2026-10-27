/* SIWILTEC service worker — política explícita (docs/politica-offline.md).
   VERSION é reescrita a cada build por scripts/stamp-sw.mjs (muda os bytes ⇒ navegador detecta atualização). */
const VERSION = "20261027140305";
const PREFIX = "siwiltec-";

// Extrai tenant do cookie; fallback "default" se ausente.
function getTenantSlug(cookieHeader) {
  if (!cookieHeader) return "default";
  const match = cookieHeader.match(/siwiltec-tenant-slug=([^;]+)/);
  return match ? match[1] : "default";
}

const STATIC = `${PREFIX}static-${VERSION}`;
const PRECACHE = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];

// Rotas cujo HTML é um shell sem dados pessoais NESTA DEMO (dados vêm do IndexedDB no cliente).
// Em produção com backend: HTML autenticado passa a NetworkOnly — ver docs/politica-offline.md.
const SHELL_ROUTES = /^\/(app(\/.*)?|portal(\/.*)?|entrar|offline)?$/;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)));
  // Sem skipWaiting automático: o usuário decide quando atualizar.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== STATIC && !k.includes(`-shell-${VERSION}`)).map((k) => caches.delete(k))),
    ),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting().then(() => self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // nunca intercepta mutações
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // nem terceiros
  if (url.pathname.startsWith("/api/")) return; // APIs privadas: rede apenas, nunca cache

  // Assets versionados por hash: imutáveis → cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/help/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) => hit || fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(STATIC).then((c) => c.put(req, copy));
          }
          return res;
        }),
      ),
    );
    return;
  }

  // Requisições RSC/Flight: nunca cachear; falha tipada (Next re-tenta com experimental.useOffline).
  if (req.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return;

  if (req.mode === "navigate") {
    const tenantSlug = getTenantSlug(req.headers.get("cookie"));
    const SHELL = `${PREFIX}tenant-${tenantSlug}-shell-${VERSION}`;
    const cacheable = SHELL_ROUTES.test(url.pathname);
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (cacheable && res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(async () => (cacheable && (await caches.match(url.pathname, { cacheName: SHELL }))) || caches.match("/offline")),
    );
  }
});
