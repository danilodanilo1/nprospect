import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import Prospect from "@/models/Prospect";
import Interaction from "@/models/Interaction";
import { ALL_STAGES } from "@/lib/funnel";
import { moveStage, release, removeProspect, setPaused, takeover } from "@/services/prospect.service";

interface Ctx {
  params: Promise<{ id: string }>;
}

export const GET = withAuth(async (_req, { params }: Ctx) => {
  const { id } = await params;
  const prospect = await Prospect.findById(id).lean();
  if (!prospect) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  const interactions = await Interaction.find({ prospect: id }).sort({ createdAt: 1 }).lean();
  return NextResponse.json({ prospect, interactions });
});

const actionSchema = z.object({
  action: z.enum(["takeover", "release", "pause", "resume", "remove", "stage"]),
  stage: z.enum(ALL_STAGES as [string, ...string[]]).optional(),
});

export const POST = withAuth(async (req, { params }: Ctx, user) => {
  const { id } = await params;
  const { action, stage } = actionSchema.parse(await req.json());
  const p = await Prospect.findById(id);
  if (!p) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  switch (action) {
    case "takeover":
      await takeover(id, user);
      break;
    case "release":
      await release(id, user);
      break;
    case "pause":
    case "resume":
      await setPaused(id, action === "pause", user);
      break;
    case "remove":
      await removeProspect(p, `removido por ${user}`, "HUMANO");
      break;
    case "stage":
      if (!stage) return NextResponse.json({ error: "Informe o estágio" }, { status: 400 });
      await moveStage(p, stage as (typeof ALL_STAGES)[number], `movido manualmente por ${user}`, "HUMANO");
      break;
  }
  return NextResponse.json(await Prospect.findById(id).lean());
});
