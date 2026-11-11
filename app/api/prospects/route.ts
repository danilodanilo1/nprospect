import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import Prospect from "@/models/Prospect";

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const filter: Record<string, unknown> = {};
  const stage = searchParams.get("stage");
  const q = searchParams.get("q");
  if (stage) filter.stage = stage;
  if (q) {
    const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    filter.$or = [{ company: rx }, { email: rx }, { contactName: rx }];
  }
  const prospects = await Prospect.find(filter).sort({ updatedAt: -1 }).limit(1000).lean();
  return NextResponse.json(prospects);
});
