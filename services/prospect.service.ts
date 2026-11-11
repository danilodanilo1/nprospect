// Operações do funil usadas pelo painel e pelo worker. Toda mudança vira uma Interaction.
import type { Types } from "mongoose";
import Prospect, { type IProspect } from "@/models/Prospect";
import Interaction, { type IInteraction } from "@/models/Interaction";
import Suppression from "@/models/Suppression";
import SystemState from "@/models/SystemState";
import { STAGE_LABELS, type AnyStage } from "@/lib/funnel";
import type { ProspectInput } from "@/lib/csv";

export async function logEvent(
  prospect: Types.ObjectId | string,
  kind: string,
  body: string,
  author: IInteraction["author"] = "SISTEMA",
  extra: Partial<IInteraction> = {},
): Promise<IInteraction> {
  return Interaction.create({
    prospect,
    channel: "SISTEMA",
    direction: "INTERNAL",
    author,
    status: "REGISTRO",
    kind,
    body,
    ...extra,
  });
}

export async function moveStage(
  p: IProspect,
  to: AnyStage,
  reason: string,
  author: IInteraction["author"] = "IA",
): Promise<void> {
  if (p.stage === to) return;
  const from = p.stage;
  p.stage = to;
  await p.save();
  await logEvent(p._id as Types.ObjectId, "mudanca-estagio", `${STAGE_LABELS[from]} → ${STAGE_LABELS[to]}: ${reason}`, author, {
    stageBefore: from,
    stageAfter: to,
    reason,
  });
}

export async function takeover(id: string, user: string): Promise<IProspect | null> {
  const p = await Prospect.findById(id);
  if (!p) return null;
  p.owner = "HUMANO";
  await p.save();
  // tudo que a IA deixou na fila para esse lead para de andar
  await Interaction.updateMany(
    { prospect: p._id, status: { $in: ["PENDENTE", "AGENDADA"] }, author: "IA" },
    { $set: { status: "REJEITADA", error: `Lead assumido por ${user}` } },
  );
  await logEvent(p._id as Types.ObjectId, "assumir", `${user} assumiu o lead. A IA não age mais nele.`, "HUMANO");
  return p;
}

export async function release(id: string, user: string): Promise<IProspect | null> {
  const p = await Prospect.findById(id);
  if (!p) return null;
  p.owner = "IA";
  p.paused = false;
  await p.save();
  await logEvent(p._id as Types.ObjectId, "devolver", `${user} devolveu o lead para a IA.`, "HUMANO");
  return p;
}

export async function setPaused(id: string, paused: boolean, user: string): Promise<IProspect | null> {
  const p = await Prospect.findById(id);
  if (!p) return null;
  p.paused = paused;
  await p.save();
  await logEvent(p._id as Types.ObjectId, paused ? "pausar" : "retomar", `${user} ${paused ? "pausou" : "retomou"} o lead.`, "HUMANO");
  return p;
}

export async function suppress(email: string, reason: string): Promise<void> {
  await Suppression.updateOne({ value: email.toLowerCase() }, { $setOnInsert: { reason } }, { upsert: true });
}

export async function removeProspect(p: IProspect, reason: string, author: IInteraction["author"]): Promise<void> {
  if (p.email) await suppress(p.email, reason);
  await Interaction.updateMany(
    { prospect: p._id, status: { $in: ["PENDENTE", "AGENDADA"] } },
    { $set: { status: "REJEITADA", error: "Lead removido" } },
  );
  p.nextActionAt = undefined;
  await moveStage(p, "REMOVER", reason, author);
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/** Importa leads (CSV ou coletor). Dedup por e-mail; sinais novos são somados. */
export async function upsertProspects(rows: ProspectInput[], source: string, batch?: string): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  for (const r of rows) {
    try {
      const existing = r.email
        ? await Prospect.findOne({ email: r.email })
        : await Prospect.findOne({ company: r.company, city: r.city });
      if (existing) {
        if (["REMOVER", "PAGANTE", "INDICACAO"].includes(existing.stage)) {
          result.skipped++;
          continue;
        }
        existing.signals.push(...r.signals);
        for (const k of ["contactName", "phone", "website", "instagram", "linkedin", "city", "cnpj", "teamSize"] as const) {
          if (r[k] !== undefined && existing.get(k) === undefined) existing.set(k, r[k]);
        }
        // lead descartado ganha nova chance se chegou sinal novo
        if (existing.stage === "DESCARTADO" && r.signals.length) existing.stage = "DESCOBERTO";
        await existing.save();
        result.updated++;
      } else {
        const p = await Prospect.create({ ...r, source, batch });
        await logEvent(p._id as Types.ObjectId, "descoberto", `Importado de ${source}${batch ? ` (lote ${batch})` : ""}.`);
        result.created++;
      }
    } catch (err) {
      result.errors.push(`${r.company}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return result;
}

export async function setRunning(running: boolean, user: string, reason?: string): Promise<void> {
  await SystemState.updateOne(
    { _id: "system" },
    { $set: { running, changedAt: new Date(), changedBy: user, pausedReason: running ? undefined : reason } },
    { upsert: true },
  );
}
