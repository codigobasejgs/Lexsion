// Propostas, contratos, assinatura e cobranças — regras puras (M14, M16, A09, A10).
import type { Charge, ChargeStatus, Contract, Installment } from "./types";
import { splitInstallments, type Cents } from "@/lib/money";
import { addDays, type CivilDate } from "@/lib/dates";

export interface ScheduleItem {
  label: string;
  amount: Cents;
  due: CivilDate;
}

/** Entrada + n parcelas com periodicidade em dias (ou datas próprias depois). Soma sempre igual ao total. */
export function buildSchedule(total: Cents, downPayment: Cents, n: number, firstDue: CivilDate, everyDays: number): ScheduleItem[] {
  if (downPayment < 0 || downPayment > total) throw new Error("Entrada inválida");
  const out: ScheduleItem[] = [];
  if (downPayment > 0) out.push({ label: "Entrada", amount: downPayment, due: firstDue });
  const rest = total - downPayment;
  if (rest > 0) {
    if (n < 1) throw new Error("Informe ao menos uma parcela para o saldo");
    splitInstallments(rest, n).forEach((amount, i) =>
      out.push({ label: `Parcela ${i + 1}/${n}`, amount, due: addDays(firstDue, everyDays * (downPayment > 0 ? i + 1 : i)) }),
    );
  }
  return out;
}

export function scheduleTotal(s: ScheduleItem[]): Cents {
  return s.reduce((a, b) => a + b.amount, 0);
}

export type SignResult = { contract: Contract; completedNow: boolean };

/** Assinatura de um signatário. Repetir o mesmo evento não muda nada (idempotente). Conclui só com todos os obrigatórios. */
export function applySignature(c: Contract, signerId: string, at: string, actorId: string): SignResult {
  if (c.status === "concluido" || c.status === "cancelado" || c.status === "recusado" || c.status === "expirado") return { contract: c, completedNow: false };
  const signer = c.signers?.find((s) => s.id === signerId);
  if (!signer || signer.status === "assinado") return { contract: c, completedNow: false };
  const signers = c.signers!.map((s) => (s.id === signerId ? { ...s, status: "assinado" as const, signedAt: at } : s));
  const done = signers.filter((s) => s.required).every((s) => s.status === "assinado");
  return {
    completedNow: done,
    contract: {
      ...c,
      signers,
      status: done ? "concluido" : "parcial",
      history: [...(c.history ?? []), { at, actorId, text: `${signer.name} assinou (simulação)${done ? " — contrato concluído" : ""}` }],
    },
  };
}

/** Gera as parcelas do contrato uma única vez. */
export function installmentsFromContract(c: Contract, idFor: (i: number) => string): Installment[] {
  if (c.installmentsGenerated || c.status !== "concluido" || !c.snapshot) return [];
  return c.snapshot.schedule.map((s, i) => ({
    id: idFor(i), organizationId: c.organizationId, contractId: c.id, clientId: c.clientId, caseId: c.caseId,
    label: s.label, amount: s.amount, paid: 0, due: s.due, status: "aberta",
  }));
}

const CHARGE_NEXT: Record<ChargeStatus, ChargeStatus[]> = {
  rascunho: ["aguardando_emissao", "cancelada"],
  aguardando_emissao: ["pendente", "erro", "cancelada"],
  pendente: ["parcialmente_paga", "paga", "vencida", "cancelada", "erro"],
  parcialmente_paga: ["paga", "vencida", "reembolsada"],
  paga: ["reembolsada", "contestada"],
  vencida: ["paga", "cancelada"],
  cancelada: [],
  reembolsada: [],
  contestada: ["paga", "reembolsada"],
  erro: ["aguardando_emissao", "cancelada"],
};

/** Aplica evento de provedor. Evento repetido (mesmo id) é ignorado; transição inválida também. */
export function applyChargeEvent(c: Charge, ev: { id: string; at: string; type: string; to: ChargeStatus; note: string }): { charge: Charge; applied: boolean } {
  if (c.events.some((e) => e.id === ev.id)) return { charge: c, applied: false };
  if (!CHARGE_NEXT[c.status].includes(ev.to)) {
    return { charge: { ...c, events: [...c.events, { id: ev.id, at: ev.at, type: `${ev.type} (ignorado: transição inválida)`, note: ev.note }] }, applied: false };
  }
  return { charge: { ...c, status: ev.to, events: [...c.events, { id: ev.id, at: ev.at, type: ev.type, note: ev.note }] }, applied: true };
}

export function isActiveCharge(c: Charge): boolean {
  return ["rascunho", "aguardando_emissao", "pendente", "parcialmente_paga", "vencida"].includes(c.status);
}

/** Valor por extenso em reais (recibo). Até 999.999.999,99. */
export function brlInWords(cents: Cents): string {
  const u = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const t = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const h = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
  const upTo999 = (n: number): string => {
    if (n === 0) return "";
    if (n === 100) return "cem";
    const parts: string[] = [];
    if (n >= 100) parts.push(h[Math.floor(n / 100)]);
    const r = n % 100;
    if (r >= 20) parts.push(t[Math.floor(r / 10)] + (r % 10 ? ` e ${u[r % 10]}` : ""));
    else if (r > 0) parts.push(u[r]);
    return parts.join(" e ");
  };
  const reais = Math.floor(cents / 100);
  const cent = cents % 100;
  const groups: string[] = [];
  const mi = Math.floor(reais / 1_000_000);
  const mil = Math.floor((reais % 1_000_000) / 1000);
  const rest = reais % 1000;
  if (mi) groups.push(`${upTo999(mi)} ${mi === 1 ? "milhão" : "milhões"}`);
  if (mil) groups.push(mil === 1 ? "mil" : `${upTo999(mil)} mil`);
  if (rest) groups.push(upTo999(rest));
  let text = "";
  if (groups.length) {
    const last = groups.length > 1 && (rest < 100 || rest % 100 === 0) && rest !== 0 ? " e " : groups.length > 1 ? ", " : "";
    text = groups.length > 1 ? groups.slice(0, -1).join(", ") + last + groups.at(-1) : groups[0];
    text += reais === 1 ? " real" : mi && !mil && !rest ? " de reais" : " reais";
  }
  if (cent) text += `${text ? " e " : ""}${upTo999(cent)} ${cent === 1 ? "centavo" : "centavos"}`;
  return text || "zero reais";
}
