import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import Interaction from "@/models/Interaction";
import "@/models/Prospect";

/** ?status=PENDENTE (aprovações) ou log geral; ?channel=EMAIL; ?limit=200 */
export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const filter: Record<string, unknown> = {};
  const status = searchParams.get("status");
  const channel = searchParams.get("channel");
  if (status) filter.status = status;
  if (channel) filter.channel = channel;
  const limit = Math.min(Number(searchParams.get("limit") ?? 200), 1000);
  const items = await Interaction.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("prospect", "company contactName email stage owner score")
    .lean();
  return NextResponse.json(items);
});
