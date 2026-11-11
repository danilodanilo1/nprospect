// Teste de ponta a ponta do worker contra um MongoDB real (TEST_MONGODB_URI).
// Sem banco disponível o teste é pulado. Ex.: docker run -d -p 27017:27017 mongo:7
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Prospect from "@/models/Prospect";
import Interaction from "@/models/Interaction";
import SystemState from "@/models/SystemState";
import Suppression from "@/models/Suppression";
import { DEFAULT_GUARD_CONFIG } from "@/lib/guard";
import { setRunning, takeover, upsertProspects } from "@/services/prospect.service";
import { tick, type Deps } from "@/worker/pipeline";
import type { IncomingMail, OutgoingMail } from "@/services/mailer";

const URI = process.env.TEST_MONGODB_URI ?? "mongodb://127.0.0.1:27017/nprospect_test";
let connected = false;

let clock = new Date("2026-11-11T13:00:00Z"); // quarta 10h SP
const sent: OutgoingMail[] = [];
const inbox: IncomingMail[] = [];
let nextClass = "INTERESSE";
let seq = 0;

const deps: Deps = {
  now: () => clock,
  llm: async (req) => {
    if (req.purpose === "classify") return { text: JSON.stringify({ class: nextClass, confidence: 0.9, summary: "ok" }), model: "fake" };
    if (req.system.includes("primeiro e-mail")) return { text: JSON.stringify({ subject: "currículos por e-mail", body: "Oi Ana, vi sua vaga." }), model: "fake" };
    return { text: JSON.stringify({ body: "Resposta da IA" }), model: "fake" };
  },
  send: async (m) => {
    sent.push(m);
    return `<msg-${++seq}@teste>`;
  },
  fetchMail: async (since) => inbox.filter((m) => m.uid > since),
  mailEnabled: true,
  guard: DEFAULT_GUARD_CONFIG,
  signupUrl: "https://nrecruit.app",
  cadenceDays: [3, 4, 3],
  collectors: [],
};

before(async () => {
  try {
    await mongoose.connect(URI, { serverSelectionTimeoutMS: 2000 });
    await mongoose.connection.dropDatabase();
    connected = true;
  } catch {
    connected = false;
  }
});

after(async () => {
  if (connected) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test("funil de ponta a ponta", async (t) => {
  if (!connected) return t.skip(`MongoDB indisponível em ${URI}`);

  await upsertProspects(
    [
      { company: "RH Ágil", contactName: "Ana Souza", email: "ana@rhagil.com", teamSize: 2, signals: [{ type: "SEM_ATS", seenAt: clock, evidenceText: "Vaga Dev Java, CV por e-mail" }] },
      { company: "Sem Sinal", email: "contato@semsinal.com", signals: [] },
      { company: "Quer Sair", contactName: "Bia", email: "bia@quersair.com", teamSize: 1, signals: [{ type: "SEM_ATS", seenAt: clock }] },
    ],
    "teste",
  );

  // desligado: nada anda
  let r = await tick(deps);
  assert.equal(r.running, false);
  assert.equal(await Prospect.countDocuments({ stage: "DESCOBERTO" }), 3);

  await setRunning(true, "teste");
  r = await tick(deps);
  assert.equal(r.qualified, 2);
  assert.equal(r.discarded, 1);
  assert.equal(r.drafted, 2);
  assert.equal(sent.length, 0, "modo APROVAR: nada sai sem aprovação");

  // humano aprova os dois rascunhos
  await Interaction.updateMany({ status: "PENDENTE" }, { $set: { status: "AGENDADA" } });
  r = await tick(deps);
  assert.equal(r.sent, 2);
  const ana = await Prospect.findOne({ email: "ana@rhagil.com" }).orFail();
  assert.equal(ana.stage, "CONTATADO");
  assert.ok(ana.threadMessageId);

  // 3 dias depois sem resposta: follow-up na mesma conversa
  clock = new Date("2026-11-17T13:00:00Z"); // terça seguinte
  r = await tick(deps);
  const fu = await Interaction.findOne({ prospect: ana._id, kind: "follow-up-1" }).orFail();
  assert.equal(fu.inReplyTo, ana.threadMessageId);
  assert.equal(fu.status, "PENDENTE");

  // Ana responde com interesse: follow-up pendente é cancelado, IA rascunha resposta
  inbox.push({ uid: 1, messageId: "<in-1@ana>", inReplyTo: ana.threadMessageId, references: [], from: "ana@rhagil.com", subject: "Re: currículos por e-mail", text: "Quero testar!", date: clock, isBounce: false });
  r = await tick(deps);
  assert.equal(r.received, 1);
  assert.equal((await Interaction.findById(fu._id).orFail()).status, "REJEITADA");
  assert.equal((await Prospect.findById(ana._id).orFail()).stage, "RESPONDEU");
  const reply = await Interaction.findOne({ prospect: ana._id, kind: "resposta" }).orFail();
  assert.equal(reply.status, "PENDENTE");

  // humano assume: rascunho da IA é cancelado e nova resposta só é registrada
  await takeover(String(ana._id), "danilo");
  assert.equal((await Interaction.findById(reply._id).orFail()).status, "REJEITADA");
  inbox.push({ uid: 2, messageId: "<in-2@ana>", inReplyTo: "<in-1@ana>", references: [ana.threadMessageId!], from: "ana@rhagil.com", subject: "Re:", text: "Alô?", date: clock, isBounce: false });
  r = await tick(deps);
  assert.equal(await Interaction.countDocuments({ prospect: ana._id, kind: "resposta", status: "PENDENTE" }), 0);

  // Bia pede para sair: bloqueio permanente
  nextClass = "REMOVER";
  const bia = await Prospect.findOne({ email: "bia@quersair.com" }).orFail();
  inbox.push({ uid: 3, messageId: "<in-3@bia>", inReplyTo: bia.threadMessageId, references: [], from: "bia@quersair.com", subject: "Re:", text: "por favor me remova", date: clock, isBounce: false });
  await tick(deps);
  assert.equal((await Prospect.findById(bia._id).orFail()).stage, "REMOVER");
  assert.ok(await Suppression.exists({ value: "bia@quersair.com" }));

  // importar Bia de novo não a traz de volta
  const again = await upsertProspects([{ company: "Quer Sair", email: "bia@quersair.com", signals: [{ type: "VOLUME_ALTO", seenAt: clock }] }], "teste");
  assert.equal(again.skipped, 1);

  // log tem a história completa
  assert.ok((await Interaction.countDocuments({ prospect: ana._id })) >= 8);
  const state = await SystemState.findById("system").lean();
  assert.equal(state?.imapLastUid, 3);
});
