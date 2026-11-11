// Executa coletores fora do worker: `npm run collect -- [nome] [--dry]`.
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { upsertProspects } from "@/services/prospect.service";
import { collectors } from "./index";

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const name = args.find((a) => !a.startsWith("--"));
  const list = name ? collectors.filter((c) => c.name === name) : collectors;
  if (list.length === 0) throw new Error(`Coletor não encontrado: ${name}. Disponíveis: ${collectors.map((c) => c.name).join(", ")}`);
  if (!dry) await connectDB();
  for (const c of list) {
    const rows = await c.run({ now: new Date(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)), log: console.log });
    console.log(`${c.name}: ${rows.length} leads`);
    if (dry) console.log(JSON.stringify(rows.slice(0, 5), null, 2));
    else console.log(await upsertProspects(rows, c.name));
  }
  if (!dry) await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
