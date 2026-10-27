// Progresso de tours/lições por usuário, papel e versão (coleção `learning`, sem organização: é do usuário).
import { readAll, writeAll } from "@/services/mock/db";
import type { LearningProgress, Role } from "@/domain/types";

export const progressId = (userId: string, kind: LearningProgress["kind"], key: string) => `${userId}:${kind}:${key}`;

export async function saveProgress(p: Omit<LearningProgress, "id" | "updatedAt">): Promise<LearningProgress> {
  const rows = await readAll("learning");
  const row: LearningProgress = { ...p, id: progressId(p.userId, p.kind, p.key), updatedAt: new Date().toISOString() };
  await writeAll("learning", [...rows.filter((r) => r.id !== row.id), row]);
  return row;
}

export type TourState = { status: "nao_iniciado" | "pausado" | "concluido" | "desatualizado"; step: number };

/** Progresso salvo em versão anterior do tour não é reaproveitado (passos podem ter mudado). */
export function tourState(rows: LearningProgress[] | undefined, userId: string | undefined, key: string, version: string, role?: Role): TourState {
  const r = rows?.find((x) => x.id === progressId(userId ?? "", "tour", key));
  if (!r) return { status: "nao_iniciado", step: 0 };
  if (r.version !== version || (role && r.role && r.role !== role)) return { status: "desatualizado", step: 0 };
  return { status: r.done ? "concluido" : "pausado", step: r.step };
}
