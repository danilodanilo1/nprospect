import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { parseCsv, rowToProspect, type ProspectInput } from "@/lib/csv";
import { upsertProspects } from "@/services/prospect.service";

/** POST { csv: string, batch?: string } */
export const POST = withAuth(async (req) => {
  const { csv, batch } = (await req.json()) as { csv?: string; batch?: string };
  if (!csv) return NextResponse.json({ error: "CSV vazio" }, { status: 400 });
  const rows = parseCsv(csv).map((r) => rowToProspect(r)).filter((r): r is ProspectInput => r !== null);
  if (rows.length === 0) return NextResponse.json({ error: "Nenhuma linha com a coluna 'empresa'" }, { status: 400 });
  const result = await upsertProspects(rows, "csv", batch);
  return NextResponse.json(result);
});
