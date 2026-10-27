"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useOffline } from "next/offline";
import { Download, HardDriveDownload, RefreshCw, Share, WifiOff, X } from "lucide-react";
import { onStorageModeChange, storageMode } from "@/services/mock/db";
import { isSessionVolatile } from "@/components/providers";

// ---- Formulários sujos: atualização nunca descarta edição (seção 4.11) ----
const dirty = new Set<string>();
export function useDirtyGuard(id: string, isDirty: boolean) {
  useEffect(() => {
    if (isDirty) dirty.add(id);
    else dirty.delete(id);
    const warn = (e: BeforeUnloadEvent) => {
      if (isDirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      dirty.delete(id);
      window.removeEventListener("beforeunload", warn);
    };
  }, [id, isDirty]);
}

// ---- Instalação ----
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let deferred: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
const DISMISS_KEY = "siwiltec.install.dismissedAt";
const VISITS_KEY = "siwiltec.visits";
const THIRTY_DAYS = 30 * 86_400_000;

function isStandalone() {
  return matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export type InstallState = "installed" | "prompt" | "ios" | "unsupported";
export function useInstall() {
  const state = useSyncExternalStore<InstallState>(
    (fn) => {
      installListeners.add(fn);
      return () => {
        installListeners.delete(fn);
      };
    },
    () => (isStandalone() ? "installed" : deferred ? "prompt" : isIOS() ? "ios" : "unsupported"),
    () => "unsupported",
  );
  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    installListeners.forEach((l) => l());
  };
  return { state, install };
}

/** Convite discreto: só a partir da 2ª visita, nunca em app instalado, dispensa vale 30 dias. */
export function useInstallInvite() {
  const { state, install } = useInstall();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      const visits = Number(localStorage.getItem(VISITS_KEY) ?? 0);
      const dismissed = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única de preferências locais após montar
      setHidden(visits < 2 || Date.now() - dismissed < THIRTY_DAYS);
    } catch {}
  }, []);
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setHidden(true);
  };
  return { visible: !hidden && (state === "prompt" || state === "ios"), state, install, dismiss };
}

// ---- Service worker + atualização ----
function useServiceWorker() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const reloading = useRef(false);
  useEffect(() => {
    try {
      localStorage.setItem(VISITS_KEY, String(Number(localStorage.getItem(VISITS_KEY) ?? 0) + 1));
    } catch {}
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred = e as BeforeInstallPromptEvent;
      installListeners.forEach((l) => l());
    };
    const onInstalled = () => {
      deferred = null;
      installListeners.forEach((l) => l());
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // SW só em build de produção (dev não é referência para offline/atualização).
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          sw?.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) setWaiting(sw);
          });
        });
        const check = () => document.visibilityState === "visible" && reg.update().catch(() => {});
        document.addEventListener("visibilitychange", check);
      }).catch(() => {});
      // Uma única recarga quando o novo SW assume (evita loop entre abas).
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading.current) return;
        reloading.current = true;
        location.reload();
      });
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return { waiting, dismiss: () => setWaiting(null) };
}

export function PwaRegister() {
  const { waiting, dismiss } = useServiceWorker();
  const offline = useOffline();
  const [blocked, setBlocked] = useState(false);

  const apply = () => {
    if (dirty.size > 0) {
      setBlocked(true);
      return;
    }
    waiting?.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-40 flex flex-col items-center gap-2 px-4 lg:bottom-6">
      <VolatileStorageNotice />
      {offline && (
        <div role="status" className="pointer-events-auto flex items-center gap-2 rounded-full border border-warning/40 bg-warning-bg px-4 py-2 text-sm text-warning shadow-lg">
          <WifiOff aria-hidden className="size-4" />
          Sem conexão — dados da demonstração continuam neste dispositivo.
        </div>
      )}
      {waiting && (
        <div role="status" className="pointer-events-auto flex w-full max-w-md flex-col gap-2 rounded-[var(--radius-panel)] border border-brand/50 bg-surface-raised p-3 text-sm shadow-xl sm:flex-row sm:items-center">
          <RefreshCw aria-hidden className="size-4 shrink-0 text-accent" />
          <span className="flex-1">
            {blocked ? "Há uma edição não salva. Salve ou descarte antes de atualizar." : "Nova versão disponível."}
          </span>
          <div className="flex gap-2">
            <button className="btn btn-ghost min-h-9" onClick={dismiss}>Depois</button>
            <button className="btn btn-primary min-h-9" onClick={apply}>Atualizar agora</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Cartão dispensável de instalação (usado no Meu dia e em Configurações). */
export function InstallCard({ force }: { force?: boolean }) {
  const invite = useInstallInvite();
  const [iosHelp, setIosHelp] = useState(false);
  const state = invite.state;
  if (!force && !invite.visible) return null;
  if (state === "installed") return <p className="text-sm text-fg-muted">O aplicativo já está instalado neste dispositivo.</p>;
  return (
    <section aria-labelledby="install-title" className="panel relative flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <Download aria-hidden className="size-6 shrink-0 text-accent" />
      <div className="flex-1">
        <h2 id="install-title" className="font-medium">Instale a SIWILTEC no seu aparelho</h2>
        <p className="text-sm text-fg-muted">Abra pelo ícone, em tela cheia, como um aplicativo. Funciona também no navegador.</p>
        {iosHelp && (
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            <li>No Safari, toque em <Share aria-label="Compartilhar" className="inline size-4" /> <strong>Compartilhar</strong>.</li>
            <li>Escolha <strong>Adicionar à Tela de Início</strong>.</li>
            <li>Toque em <strong>Adicionar</strong>.</li>
          </ol>
        )}
        {state === "unsupported" && <p className="mt-1 text-sm text-fg-muted">Este navegador não oferece instalação programática. Use o menu do navegador (“Instalar app” ou “Adicionar à tela inicial”), quando disponível.</p>}
      </div>
      <div className="flex gap-2">
        {state === "prompt" && <button className="btn btn-primary" onClick={invite.install}>Instalar aplicativo</button>}
        {state === "ios" && <button className="btn btn-primary" onClick={() => setIosHelp(true)}>Como instalar</button>}
      </div>
      {!force && (
        <button className="btn btn-ghost absolute right-1 top-1 min-h-9 px-2" onClick={invite.dismiss} aria-label="Dispensar convite de instalação por 30 dias">
          <X aria-hidden className="size-4" />
        </button>
      )}
    </section>
  );
}

/** ROB-01: armazenamento do navegador bloqueado ⇒ a demo roda em memória; avisa sem travar. */
function VolatileStorageNotice() {
  const volatile = useSyncExternalStore(
    onStorageModeChange,
    () => storageMode() === "memory" || isSessionVolatile(),
    () => false,
  );
  if (!volatile) return null;
  return (
    <div role="status" data-testid="aviso-armazenamento" className="pointer-events-auto flex max-w-md items-center gap-2 rounded-[var(--radius-panel)] border border-warning/40 bg-warning-bg px-4 py-2 text-sm text-warning shadow-lg">
      <HardDriveDownload aria-hidden className="size-4 shrink-0" />
      Armazenamento do navegador indisponível: o que você fizer fica só nesta aba e some ao fechá-la.
    </div>
  );
}
