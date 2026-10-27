"use client";

import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { Organization, User } from "@/domain/types";
import type { Tenant } from "@/domain/tenancy";
import { list } from "@/services/mock/repo";
import { onExternalChange, resetDemo, type CollectionName, type Row } from "@/services/mock/db";
import { organizations, users } from "@/mocks/fixtures";
import { tenants } from "@/mocks/tenants";
import type { RequestContext } from "@/services/contracts";

// Sessão FICTÍCIA em localStorage (só ids — nunca credenciais).
const SESSION_KEY = "siwiltec.session";
type Session = { userId: string; organizationId: string | null };

// localStorage bloqueado (navegação privada, política do navegador): sessão fica só em memória nesta aba.
let memorySession: string | null = null;
let sessionInMemory = false;
export const isSessionVolatile = () => sessionInMemory;

function rawSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    sessionInMemory = true;
    return memorySession;
  }
}

const sessionListeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedSession: Session | null = null;
function getSnapshot(): Session | null {
  const raw = rawSession();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedSession = raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      cachedSession = null; // valor corrompido ⇒ sem sessão (volta para /entrar)
    }
  }
  return cachedSession;
}
function subscribe(fn: () => void) {
  sessionListeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    sessionListeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}
function writeSession(s: Session | null) {
  const raw = s ? JSON.stringify(s) : null;
  try {
    if (raw) localStorage.setItem(SESSION_KEY, raw);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    sessionInMemory = true;
    memorySession = raw;
  }
  sessionListeners.forEach((l) => l());
}

interface SessionCtx {
  ready: boolean;
  user: User | null;
  org: Organization | null;
  tenant: Tenant | null;
  ctx: RequestContext | null;
  signIn: (userId: string, organizationId?: string | null) => void;
  switchOrg: (organizationId: string) => void;
  signOut: () => Promise<void>;
  restoreDemo: () => Promise<void>;
}

const Ctx = createContext<SessionCtx | null>(null);

export function useSession(): SessionCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession fora do Providers");
  return v;
}

function SessionProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const session = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const user = users.find((u) => u.id === session?.userId) ?? null;
  const org = organizations.find((o) => o.id === session?.organizationId) ?? null;
  const tenant = tenants.find((t) => t.id === org?.id) ?? null;

  useEffect(() => onExternalChange(() => qc.invalidateQueries()), [qc]);

  const value = useMemo<SessionCtx>(() => ({
    ready,
    user,
    org,
    tenant,
    ctx: user && org ? { organizationId: org.id, actorId: user.id } : null,
    signIn: (userId, organizationId) => {
      const u = users.find((x) => x.id === userId);
      if (!u) return;
      qc.clear();
      writeSession({ userId, organizationId: organizationId ?? u.organizationId });
    },
    switchOrg: (organizationId) => {
      if (!session) return;
      qc.clear(); // nenhum dado de um escritório sobrevive na troca (A12)
      writeSession({ ...session, organizationId });
    },
    signOut: async () => {
      qc.clear();
      await clearShellCache();
      writeSession(null);
      router.replace("/entrar");
    },
    restoreDemo: async () => {
      await resetDemo();
      await clearShellCache();
      qc.clear();
      await qc.invalidateQueries();
    },
  }), [ready, user, org, tenant, session, qc, router]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Remove HTML de shell cacheado pelo SW (sair/restaurar não deixa telas de sessão anterior). Estáticos ficam. */
async function clearShellCache() {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("siwiltec-shell-")).map((k) => caches.delete(k)));
  } catch {}
}

/** Leitura de coleção escopada pela organização atual. */
export function useCollection<C extends CollectionName>(name: C) {
  const { org, ready } = useSession();
  return useQuery({
    queryKey: [name, org?.id ?? null],
    queryFn: () => list(name, org?.id ?? null),
    enabled: ready && !!org,
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return useCallback((...names: CollectionName[]) => Promise.all(names.map((n) => qc.invalidateQueries({ queryKey: [n] }))), [qc]);
}

export type { Row };

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, networkMode: "always" }, mutations: { networkMode: "always" } } }));
  return (
    <QueryClientProvider client={qc}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
