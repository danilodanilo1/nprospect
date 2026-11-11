// Coletor mais simples: lê os CSVs largados em data/inbox/ e move para data/inbox/lidos/.
// Serve para pesquisa manual e para a saída de scripts gerados pela skill reverse-api-engineer.
import { promises as fs } from "node:fs";
import path from "node:path";
import { parseCsv, rowToProspect, type ProspectInput } from "@/lib/csv";
import type { Collector } from "./types";

const INBOX = path.join(process.cwd(), "data", "inbox");

export const csvInbox: Collector = {
  name: "csv-inbox",
  everyHours: 0,
  requiresLogin: false,
  async run(ctx) {
    const done = path.join(INBOX, "lidos");
    await fs.mkdir(done, { recursive: true });
    const files = (await fs.readdir(INBOX)).filter((f) => f.toLowerCase().endsWith(".csv"));
    const out: ProspectInput[] = [];
    for (const f of files) {
      const text = await fs.readFile(path.join(INBOX, f), "utf8");
      const rows = parseCsv(text).map((r) => rowToProspect(r, ctx.now)).filter((r): r is ProspectInput => r !== null);
      out.push(...rows);
      await fs.rename(path.join(INBOX, f), path.join(done, `${ctx.now.toISOString().slice(0, 10)}-${f}`));
      ctx.log(`csv-inbox: ${rows.length} leads de ${f}`);
    }
    return out;
  },
};
