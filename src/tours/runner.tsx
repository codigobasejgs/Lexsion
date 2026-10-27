"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/components/providers";
import { TOURS, type Tour } from "./tours";
import { saveProgress } from "./progress";

// Motor próprio de tours: espera o alvo existir, troca de rota, rola até o alvo, não prende o usuário
// quando o seletor some (A15), restaura o foco ao sair e respeita prefers-reduced-motion.
const WAIT_MS = 4000;

type Ctx = { start: (id: string, fromStep?: number) => void; activeId: string | null };
const TourCtx = createContext<Ctx>({ start: () => {}, activeId: null });
export const useTour = () => useContext(TourCtx);

function findTarget(target: string | string[]): HTMLElement | null {
  for (const t of Array.isArray(target) ? target : [target]) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${t}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const router = useRouter();
  const path = usePathname();
  const qc = useQueryClient();
  const [tour, setTour] = useState<Tour | null>(null);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [missing, setMissing] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  const persist = useCallback(async (t: Tour, s: number, done: boolean) => {
    if (!user) return;
    await saveProgress({ userId: user.id, kind: "tour", key: t.id, role: user.role, version: t.version, step: s, done });
    await qc.invalidateQueries({ queryKey: ["learning"] });
  }, [user, qc]);

  const start = useCallback((id: string, fromStep = 0) => {
    const t = TOURS.find((x) => x.id === id);
    if (!t) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    setTour(t);
    setStep(Math.min(fromStep, t.steps.length - 1));
  }, []);

  const close = useCallback(async (done: boolean) => {
    if (tour) await persist(tour, step, done);
    setTour(null);
    setRect(null);
    setMissing(false);
    returnFocus.current?.focus?.();
  }, [tour, step, persist]);

  const current = tour?.steps[step];

  // Navega até a rota do passo e espera o alvo aparecer.
  useEffect(() => {
    if (!tour || !current) return;
    if (path !== current.route.split("?")[0]) {
      router.push(current.route);
      return;
    }
    let el: HTMLElement | null = null;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const update = () => {
      if (el?.isConnected) setRect(el.getBoundingClientRect());
    };
    const t0 = Date.now();
    const poll = setInterval(() => {
      el = findTarget(current.target);
      if (el) {
        clearInterval(poll);
        setMissing(false);
        el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
        update();
        setTimeout(update, reduce ? 0 : 350);
        titleRef.current?.focus();
      } else if (Date.now() - t0 > WAIT_MS) {
        clearInterval(poll);
        setRect(null);
        setMissing(true);
        titleRef.current?.focus();
      }
    }, 100);
    addEventListener("scroll", update, true);
    addEventListener("resize", update);
    void persist(tour, step, false);
    return () => {
      clearInterval(poll);
      removeEventListener("scroll", update, true);
      removeEventListener("resize", update);
    };
  }, [tour, current, step, path, router, persist]);

  useEffect(() => {
    if (!tour) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void close(false);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [tour, close]);

  const go = (n: number) => {
    setRect(null);
    setMissing(false);
    setStep(n);
  };
  const last = tour ? step === tour.steps.length - 1 : false;

  // Popover: ancorado ao alvo no desktop; fixo no rodapé em telas estreitas.
  const style: React.CSSProperties = {};
  if (rect && typeof window !== "undefined" && window.innerWidth >= 640) {
    const below = rect.bottom + 12 + 220 < window.innerHeight;
    style.top = below ? rect.bottom + 12 : Math.max(12, rect.top - 12 - 220);
    style.left = Math.min(Math.max(12, rect.left), window.innerWidth - 372);
  }

  return (
    <TourCtx.Provider value={{ start, activeId: tour?.id ?? null }}>
      {children}
      {tour && current && (
        <>
          {rect && <div aria-hidden className="pointer-events-none fixed z-[60] rounded-[var(--radius-control)] ring-4 ring-[var(--brand)] ring-offset-2 ring-offset-[var(--canvas)] transition-all motion-reduce:transition-none" style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }} />}
          <div role="dialog" aria-modal="false" aria-labelledby={titleId} data-testid="tour-popover"
            className={`fixed z-[61] w-auto max-w-[360px] rounded-[var(--radius-panel)] border border-brand/50 bg-surface-raised p-4 shadow-2xl ${rect && style.top !== undefined ? "" : "inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+84px)] mx-auto sm:inset-x-auto sm:bottom-6 sm:right-6"}`}
            style={style}>
            <p className="text-xs text-fg-muted">{tour.title} · passo {step + 1} de {tour.steps.length}</p>
            <h2 id={titleId} ref={titleRef} tabIndex={-1} className="mt-1 font-semibold outline-none">{current.title}</h2>
            <p className="mt-1 text-sm">{missing ? "Este elemento não está visível agora (perfil, tela menor ou item já concluído). Você pode pular este passo." : current.body}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="btn btn-ghost min-h-9 text-sm" onClick={() => close(true)}>Pular tour</button>
              <button className="btn btn-ghost min-h-9 text-sm" onClick={() => close(false)}>Pausar</button>
              <span className="flex-1" />
              {step > 0 && <button className="btn btn-secondary min-h-9 text-sm" onClick={() => go(step - 1)}>Voltar</button>}
              <button className="btn btn-primary min-h-9 text-sm" onClick={() => (last ? close(true) : go(step + 1))}>{last ? "Concluir" : missing ? "Pular passo" : "Avançar"}</button>
            </div>
          </div>
        </>
      )}
    </TourCtx.Provider>
  );
}
