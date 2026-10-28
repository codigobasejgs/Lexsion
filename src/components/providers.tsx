"use client";

import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Organization, User } from "@/domain/types";
import type { Tenant } from "@/domain/tenancy";
import { list } from "@/services/mock/repo";
import { onExternalChange, readAll, resetDemo, resetTenant, type CollectionName, type Row } from "@/services/mock/db";
import { organizations, users } from "@/mocks/fixtures";
import { tenants } from "@/mocks/tenants";
import type { RequestContext } from "@/services/contracts";
import { isShellCache } from "@/lib/shell-cache";
import { DEMO_COOKIE } from "@/lib/tenant-resolver";
import { activateReal, leaveRealMode, loadRealSession, preferOrg, realSignOut, type RealSession } from "./real-session";

// Rotas que só existem na demonstração: nelas nunca se usa a sessão real.
const DEMO_ONLY = /^\/(demonstracao|demo)(\/|$)/;

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
  /** "real": Supabase + RLS, sem dado fictício. "demo": dados fictícios locais (IndexedDB), nunca enviados ao servidor. */
  mode: "real" | "demo";
  /** Escritórios do usuário (troca de escritório). */
  orgs: Organization[];
  user: User | null;
  org: Organization | null;
  tenant: Tenant | null;
  ctx: RequestContext | null;
  signIn: (userId: string, organizationId?: string | null) => void;
  switchOrg: (organizationId: string) => void;
  /** Encerra a sessão. NUNCA apaga dados da demo (DATA-02). */
  signOut: () => Promise<void>;
  /** Reinicia só o escritório atual (ação administrativa separada, com confirmação na UI). */
  restoreTenant: () => Promise<void>;
  /** Reinicia a demo inteira — exclusivo do Super Admin. */
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
  const pathname = usePathname();
  const session = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  // undefined = carregando; null = sem sessão real (vale a demonstração, se escolhida em /demonstracao).
  const [real, setReal] = useState<RealSession | null | undefined>(undefined);
  const [offline, setOffline] = useState(false);
  // Sessão demonstrativa escolhida em /demonstracao tem prioridade nesta aba até "Sair"; o login real a apaga (clearDemoSession).
  const demoOnly = DEMO_ONLY.test(pathname ?? "") || !!session;
  if (demoOnly) leaveRealMode(); // antes de qualquer leitura: a demo nunca toca o banco real
  useEffect(() => {
    if (demoOnly || real !== undefined) return;
    let alive = true;
    loadRealSession().then((r) => alive && setReal(r), () => { if (alive) { setOffline(true); setReal(null); } });
    return () => { alive = false; };
  }, [demoOnly, real]);
  const ready = hydrated && (demoOnly || real !== undefined);
  const demoUser = users.find((u) => u.id === session?.userId) ?? null;
  // Escritórios e marcas vêm do banco da demo (criados/editados no Super Admin persistem); fixture é só o ponto de partida.
  const isReal = !demoOnly && !!real;
  if (isReal) activateReal(real!); // ao voltar da demonstração na mesma aba, religa o banco real antes de ler
  const orgRows = useQuery({ queryKey: ["organizations", "catalog"], queryFn: () => readAll("organizations"), enabled: ready && !isReal });
  const tenantRows = useQuery({ queryKey: ["tenants"], queryFn: () => readAll("tenants"), enabled: ready && !isReal });
  const user = isReal ? real!.user : demoUser;
  const org = isReal ? real!.org : (orgRows.data ?? organizations).find((o) => o.id === session?.organizationId) ?? null;
  const tenant = isReal ? real!.tenant : (tenantRows.data ?? tenants).find((t) => t.id === org?.id) ?? null;

  useEffect(() => onExternalChange(() => qc.invalidateQueries()), [qc]);

  const value = useMemo<SessionCtx>(() => isReal ? {
    ready, mode: "real", orgs: real!.orgs, user, org, tenant,
    ctx: user && org ? { organizationId: org.id, actorId: user.id } : null,
    signIn: () => {},
    switchOrg: (organizationId) => {
      if (!real!.orgs.some((o) => o.id === organizationId)) return;
      preferOrg(organizationId);
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarga completa: nada do escritório anterior fica em memória
      location.assign("/app/inicio"); // recarrega: nenhum dado de um escritório sobrevive na troca
    },
    signOut: async () => {
      qc.clear();
      await clearShellCache();
      await realSignOut();
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarga completa limpa a sessão em memória
      location.assign("/entrar");
    },
    restoreTenant: async () => {}, // nunca em dados reais
    restoreDemo: async () => {},
  } : {
    ready,
    mode: "demo",
    orgs: organizations,
    user,
    org,
    tenant,
    ctx: user && org ? { organizationId: org.id, actorId: user.id } : null,
    signIn: (userId, organizationId) => {
      const u = users.find((x) => x.id === userId);
      if (!u) return;
      leaveRealMode();
      markMode("demo");
      qc.clear();
      const orgId = organizationId ?? u.organizationId;
      setDemoCookie(tenants.find((t) => t.id === orgId)?.slug);
      writeSession({ userId, organizationId: orgId });
    },
    switchOrg: (organizationId) => {
      if (!session) return;
      qc.clear(); // nenhum dado de um escritório sobrevive na troca (A12)
      setDemoCookie(tenants.find((t) => t.id === organizationId)?.slug);
      writeSession({ ...session, organizationId });
    },
    signOut: async () => {
      qc.clear();
      await clearShellCache();
      router.replace("/demonstracao"); // sair da demonstração volta à escolha de perfis
      writeSession(null);
      setDemoCookie(undefined); // entrada volta a mostrar a marca LexSion
    },
    restoreTenant: async () => {
      if (!org) return;
      await resetTenant(org.id);
      qc.clear();
      await qc.invalidateQueries();
    },
    restoreDemo: async () => {
      if (user?.role !== "superadmin") return;
      await resetDemo();
      await clearShellCache();
      qc.clear();
      await qc.invalidateQueries();
    },
  }, [isReal, real, ready, user, org, tenant, session, qc, router]);

  // Sessão real não carregou por rede/serviço: avisa e oferece tentar de novo (nunca mostra a demonstração no lugar).
  if (offline && !demoOnly && /^\/(app|portal|admin)(\/|$)/.test(pathname ?? ""))
    return (
      <main id="conteudo" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-5 text-center">
        <h1 className="text-2xl font-semibold">Sem conexão com o servidor</h1>
        <p className="text-fg-muted">Não foi possível confirmar sua sessão agora. Nenhum dado foi alterado. Verifique a internet e tente de novo.</p>
        <button className="btn btn-primary" onClick={() => { setOffline(false); setReal(undefined); }}>Tentar de novo</button>
      </main>
    );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Remove HTML de shell cacheado pelo SW ao sair/restaurar (BUG-02 corrigido: nomes por contexto não eram apagados).
 * Apaga QUALQUER cache de shell da aplicação; estáticos versionados ficam. Não toca no IndexedDB (dados da demo).
 */
async function clearShellCache() {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter(isShellCache).map((k) => caches.delete(k)));
  } catch {}
}

/**
 * Cookie só com o slug PÚBLICO do escritório demo: diz ao servidor qual manifesto/título/ícone servir em /app e /portal.
 * Gravado ANTES da navegação para o HTML do servidor já vir certo. Não é sessão nem autorização.
 */
export function setDemoCookie(slug: string | undefined) {
  document.cookie = slug ? `${DEMO_COOKIE}=${encodeURIComponent(slug)}; path=/; max-age=31536000; samesite=lax` : `${DEMO_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/** Esta aba usou a demonstração por último? (sair da demo volta à escolha de perfis, não ao login real). */
export function lastWasDemo() {
  try { return sessionStorage.getItem("lexsion.lastMode") === "demo"; } catch { return false; }
}
function markMode(m: "demo" | "real") {
  try { sessionStorage.setItem("lexsion.lastMode", m); } catch {}
}

/** Apaga a sessão demonstrativa (chamado no login real): a partir daí a aba usa só a sessão real. */
export function clearDemoSession() {
  markMode("real");
  setDemoCookie(undefined);
  writeSession(null);
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
