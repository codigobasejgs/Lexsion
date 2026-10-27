// Persistência demonstrativa: IndexedDB com fallback em memória identificado (seção 4.10).
// Uma object store "collections": chave = nome da coleção, valor = array de registros.
import * as fx from "@/mocks/fixtures";
import * as ops from "@/mocks/fixtures-ops";

const DB_NAME = "siwiltec-demo";
// ponytail: mudar o formato das fixtures (FIXTURE_VERSION) recria a demo do zero; migração por campo quando houver dado real.
const DB_VERSION = fx.FIXTURE_VERSION;
const STORE = "collections";

export const COLLECTIONS = {
  organizations: fx.organizations,
  users: fx.users,
  clients: fx.clients,
  cases: fx.cases,
  tasks: fx.tasks,
  deadlines: fx.deadlines,
  events: fx.events,
  conversations: fx.conversations,
  messages: fx.messages,
  leads: fx.leads,
  documents: fx.documents,
  contracts: [...fx.contracts, ...ops.contractsExtra] as typeof fx.contracts,
  installments: fx.installments,
  payments: fx.payments,
  pensionAnalyses: fx.pensionAnalyses,
  audit: fx.audit,
  processes: ops.processes,
  caseEvents: ops.caseEvents,
  publications: ops.publications,
  proposals: ops.proposals,
  charges: ops.charges,
  expenses: ops.expenses,
  bankLines: ops.bankLines,
  receipts: ops.receipts,
  requisitions: ops.requisitions,
  calculations: ops.calculations,
  templates: ops.templates,
  drafts: ops.drafts,
  agents: ops.agents,
  agentRuns: ops.agentRuns,
  automations: ops.automations,
  automationRuns: ops.automationRuns,
  campaigns: ops.campaigns,
  landingPages: ops.landingPages,
  contents: ops.contents,
  news: ops.news,
  integrations: ops.integrations,
  integrationEvents: ops.integrationEvents,
  outbox: ops.outbox,
  importBatches: ops.importBatches,
  notifications: ops.notifications,
  objections: ops.objections,
  settings: ops.settings,
  learning: ops.learning,
  files: ops.files,
} as const;

export type CollectionName = keyof typeof COLLECTIONS;
export type Row<C extends CollectionName> = (typeof COLLECTIONS)[C][number];

export type StorageMode = "indexeddb" | "memory";
let mode: StorageMode = "indexeddb";
const memory = new Map<string, unknown[]>();
let dbPromise: Promise<IDBDatabase> | null = null;

export function storageMode(): StorageMode {
  return mode;
}

function seedValue(name: CollectionName): unknown[] {
  const rows = structuredClone(COLLECTIONS[name]) as unknown[];
  if (name !== "installments") return rows;
  // Saldos das parcelas derivados dos pagamentos — uma só fonte de verdade.
  return (rows as fx_Installment[]).map((i) => {
    const paid = fx.payments.filter((p) => p.installmentId === i.id).reduce((s, p) => s + p.amount, 0);
    return { ...i, paid, status: paid === 0 ? "aberta" : paid >= i.amount ? "paga" : "parcial" };
  });
}
type fx_Installment = (typeof fx.installments)[number];

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB indisponível"));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (db.objectStoreNames.contains(STORE)) db.deleteObjectStore(STORE);
      const store = db.createObjectStore(STORE);
      for (const name of Object.keys(COLLECTIONS) as CollectionName[]) store.put(seedValue(name), name);
      store.put(fx.FIXTURE_VERSION, "__fixtureVersion");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB bloqueado por outra aba"));
  });
  dbPromise.catch(() => {
    mode = "memory";
  });
  return dbPromise;
}

function tx<T>(db: IDBDatabase, kind: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, kind);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(r.result);
    t.onerror = () => reject(t.error);
  });
}

export async function readAll<C extends CollectionName>(name: C): Promise<Row<C>[]> {
  try {
    const db = await openDb();
    const v = await tx(db, "readonly", (s) => s.get(name));
    return (v ?? seedValue(name)) as Row<C>[];
  } catch {
    if (!memory.has(name)) memory.set(name, seedValue(name));
    return memory.get(name) as Row<C>[];
  }
}

export async function writeAll<C extends CollectionName>(name: C, rows: Row<C>[]): Promise<void> {
  try {
    const db = await openDb();
    await tx(db, "readwrite", (s) => s.put(rows, name));
  } catch {
    memory.set(name, rows);
  }
  broadcast();
}

/** Escreve várias coleções numa única transação (tudo ou nada) — usado em operações encadeadas. */
export async function writeMany(patch: Partial<{ [C in CollectionName]: Row<C>[] }>): Promise<void> {
  const entries = Object.entries(patch) as [CollectionName, unknown[]][];
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(STORE, "readwrite");
      const s = t.objectStore(STORE);
      for (const [name, rows] of entries) s.put(rows, name);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } catch {
    for (const [name, rows] of entries) memory.set(name, rows);
  }
  broadcast();
}

/** Restaura a demo: apaga somente o banco demonstrativo e reaplica fixtures. */
export async function resetDemo(): Promise<void> {
  memory.clear();
  if (dbPromise) (await dbPromise.catch(() => null))?.close();
  dbPromise = null;
  await new Promise<void>((resolve) => {
    if (typeof indexedDB === "undefined") return resolve();
    const r = indexedDB.deleteDatabase(DB_NAME);
    r.onsuccess = r.onerror = r.onblocked = () => resolve();
  });
  broadcast();
}

// Outras abas recarregam os dados quando esta escreve.
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("siwiltec-demo") : null;
const listeners = new Set<() => void>();
function broadcast() {
  channel?.postMessage("changed");
}
channel?.addEventListener("message", () => listeners.forEach((l) => l()));
export function onExternalChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
