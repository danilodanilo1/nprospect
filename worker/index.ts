// Worker local: `npm run worker`. Roda um tick por minuto até ser encerrado (Ctrl+C).
// Liga/Desliga vem do banco (botão no painel); este processo só obedece.
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { guardConfigFromEnv } from "@/lib/guard";
import { complete } from "@/services/llm-router";
import { fetchNewMail, mailConfigured, sendMail } from "@/services/mailer";
import { collectors } from "@/collectors";
import { tick, type Deps } from "./pipeline";

const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_SECONDS ?? 60) * 1000;

const deps: Deps = {
  now: () => new Date(),
  llm: complete,
  send: sendMail,
  fetchMail: fetchNewMail,
  mailEnabled: mailConfigured(),
  guard: guardConfigFromEnv(),
  signupUrl: process.env.NRECRUIT_SIGNUP_URL ?? "https://nrecruit.app",
  cadenceDays: [3, 4, 3],
  collectors,
};

let stopping = false;

async function main() {
  await connectDB();
  console.log(`[worker] conectado. E-mail ${deps.mailEnabled ? "configurado" : "NÃO configurado (só qualifica e redige)"}.`);
  while (!stopping) {
    const started = Date.now();
    try {
      const r = await tick(deps);
      const moved = r.collected + r.qualified + r.discarded + r.drafted + r.sent + r.received + r.lost;
      if (moved || r.errors.length) {
        console.log(
          `[worker] ${new Date().toISOString()} ${r.running ? "LIGADO" : "DESLIGADO"} coletados=${r.collected} qualificados=${r.qualified} descartados=${r.discarded} rascunhos=${r.drafted} enviados=${r.sent} bloqueados=${r.blocked} recebidos=${r.received} perdidos=${r.lost}`,
        );
        for (const e of r.errors) console.warn(`[worker] aviso: ${e}`);
      }
    } catch (err) {
      console.error("[worker] erro no tick:", err);
    }
    const wait = Math.max(1000, INTERVAL_MS - (Date.now() - started));
    await new Promise((res) => setTimeout(res, wait));
  }
  await mongoose.disconnect();
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.log("[worker] encerrando…");
    stopping = true;
    setTimeout(() => process.exit(0), 3000).unref();
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
