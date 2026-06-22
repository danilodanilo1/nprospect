import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { enrichLeadWithAI } from "@/services/ai.service";
import { mapLeadToDTO } from "@/lib/lead-mapper";
import { logActivity } from "@/services/activity-log.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const lead = await enrichLeadWithAI(id);

    if (!lead) {
      return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
    }

    return NextResponse.json(mapLeadToDTO(lead));
  } catch (error) {
    await logActivity("error", "ai-enrich", "Falha ao enriquecer lead", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      { status: 500 },
    );
  }
}
