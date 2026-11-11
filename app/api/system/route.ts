import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import SystemState, { getSystemState } from "@/models/SystemState";
import Prospect from "@/models/Prospect";
import Interaction from "@/models/Interaction";
import { STAGES } from "@/lib/funnel";
import { setRunning } from "@/services/prospect.service";

export const GET = withAuth(async () => {
  const [state, byStage, pending, sent24h] = await Promise.all([
    getSystemState(),
    Prospect.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$stage", n: { $sum: 1 } } }]),
    Interaction.countDocuments({ status: "PENDENTE" }),
    Interaction.countDocuments({ status: "ENVIADA", sentAt: { $gte: new Date(Date.now() - 864e5) } }),
  ]);
  const heartbeat = state.workerHeartbeatAt ? new Date(state.workerHeartbeatAt).getTime() : 0;
  return NextResponse.json({
    running: state.running,
    pausedReason: state.pausedReason ?? null,
    changedAt: state.changedAt,
    changedBy: state.changedBy ?? null,
    stageModes: state.stageModes,
    workerOnline: Date.now() - heartbeat < 3 * 60 * 1000,
    workerHeartbeatAt: state.workerHeartbeatAt ?? null,
    counts: Object.fromEntries(byStage.map((s) => [s._id, s.n])),
    pendingApprovals: pending,
    sentLast24h: sent24h,
  });
});

const patchSchema = z.object({
  running: z.boolean().optional(),
  stageModes: z.record(z.enum(STAGES), z.enum(["AUTO", "APROVAR", "DESLIGADO"])).optional(),
});

export const PATCH = withAuth(async (req, _ctx: unknown, user) => {
  const body = patchSchema.parse(await req.json());
  if (body.running !== undefined) await setRunning(body.running, user, body.running ? undefined : "Desligado no painel");
  if (body.stageModes) {
    const state = await getSystemState();
    await SystemState.updateOne({ _id: "system" }, { $set: { stageModes: { ...state.stageModes, ...body.stageModes } } });
  }
  return NextResponse.json(await getSystemState());
});
