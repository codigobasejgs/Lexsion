/* SIWILTEC service worker — política explícita (docs/politica-offline.md).
   VERSION é reescrita a cada build por scripts/stamp-sw.mjs (muda os bytes ⇒ navegador detecta atualização). */
const VERSION = "20261027205023";
const PREFIX = "siwiltec-";

// Cache de shell separado por contexto, derivado da URL (o SW não lê cookies): admin, portal, escritório demo ou app.
// Nenhum dado de escritório entra no Cache Storage: o HTML é shell; dados ficam no IndexedDB. Sair apaga todos os shells.
function shellCacheFor(pathname) {
  const demo = pathname.match(/^\/demo\/tenant\/([a-z0-9-]+)/);
  const ctx = pathname.startsWith("/admin") ? "admin" : pathname.startsWith("/portal") ? "portal" : demo ? `tenant-${demo[1]}` : "app";
  return `${PREFIX}${ctx}-shell-${VERSION}`;
}

const STATIC = `${PREFIX}static-${VERSION}`;
const PRECACHE = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png"];

// Rotas cujo HTML é um shell sem dados pessoais NESTA DEMO (dados vêm do IndexedDB no cliente).
// Em produção com backend: HTML autenticado passa a NetworkOnly — ver docs/politica-offline.md.
const SHELL_ROUTES = /^\/(app(\/.*)?|portal(\/.*)?|admin(\/.*)?|demo\/tenant\/[a-z0-9-]+|entrar|demonstracao|offline)?$/;

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
    const SHELL = shellCacheFor(url.pathname);
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
