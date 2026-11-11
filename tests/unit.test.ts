import { test } from "node:test";
import assert from "node:assert/strict";
import { canAdvance, isPersonalEmail, scoreProspect } from "@/lib/funnel";
import { checkSend, DEFAULT_GUARD_CONFIG, type GuardContext } from "@/lib/guard";
import { parseCsv, rowToProspect } from "@/lib/csv";
import { stripQuoted } from "@/services/mailer";

const now = new Date("2026-11-11T13:00:00Z"); // quarta, 10h em São Paulo

test("score: sem sinal recente é zero", () => {
  const old = new Date(now.getTime() - 20 * 864e5);
  assert.equal(scoreProspect({ signals: [{ type: "SEM_ATS", seenAt: old }], hasPersonalEmail: true, isRecruitmentCompany: true }, now), 0);
});

test("score: recruta sem ATS + e-mail pessoal + time pequeno qualifica", () => {
  const s = scoreProspect({ signals: [{ type: "SEM_ATS", seenAt: now }], teamSize: 3, hasPersonalEmail: true, isRecruitmentCompany: true }, now);
  assert.equal(s, 70);
});

test("score: sinais repetidos não somam duas vezes", () => {
  const s = scoreProspect({ signals: [{ type: "VOLUME_ALTO", seenAt: now }, { type: "VOLUME_ALTO", seenAt: now }], hasPersonalEmail: false, isRecruitmentCompany: true }, now);
  assert.equal(s, 25);
});

test("e-mail genérico não conta como pessoal", () => {
  assert.equal(isPersonalEmail("contato@x.com.br"), false);
  assert.equal(isPersonalEmail("vagas@x.com"), false);
  assert.equal(isPersonalEmail("maria.silva@x.com"), true);
  assert.equal(isPersonalEmail("mariarh@gmail.com"), true);
});

test("funil só anda para frente ou para uma saída", () => {
  assert.equal(canAdvance("QUALIFICADO", "CONTATADO"), true);
  assert.equal(canAdvance("CONTATADO", "QUALIFICADO"), false);
  assert.equal(canAdvance("CONTATADO", "REMOVER"), true);
  assert.equal(canAdvance("REMOVER", "CONTATADO"), false);
});

const base: GuardContext = {
  now,
  systemRunning: true,
  ownerIsHuman: false,
  suppressed: false,
  isFirstTouch: true,
  isReplyToInbound: false,
  sentFirstTouchesToday: 0,
  sentLast7Days: 0,
  bouncesLast7Days: 0,
  removalsToday: 0,
};

test("guarda: libera envio normal na janela", () => {
  assert.deepEqual(checkSend(base), { ok: true });
});

test("guarda: bloqueia desligado, humano, bloqueio, limite", () => {
  assert.equal(checkSend({ ...base, systemRunning: false }).ok, false);
  assert.equal(checkSend({ ...base, ownerIsHuman: true }).ok, false);
  assert.equal(checkSend({ ...base, suppressed: true }).ok, false);
  assert.equal(checkSend({ ...base, sentFirstTouchesToday: 20 }).ok, false);
  assert.equal(checkSend({ ...base, sentFirstTouchesToday: 20, isFirstTouch: false }).ok, true);
});

test("guarda: fora do horário e na sexta não envia frio, mas responde lead", () => {
  const night = new Date("2026-11-11T23:00:00Z");
  const friday = new Date("2026-11-13T13:00:00Z");
  assert.equal(checkSend({ ...base, now: night }).ok, false);
  assert.equal(checkSend({ ...base, now: friday }).ok, false);
  assert.equal(checkSend({ ...base, now: night, isFirstTouch: false, isReplyToInbound: true }).ok, true);
});

test("guarda: bounce alto e remoções pausam a campanha", () => {
  const b = checkSend({ ...base, sentLast7Days: 50, bouncesLast7Days: 3 });
  assert.equal(b.ok, false);
  assert.equal(!b.ok && b.pauseCampaign, true);
  const r = checkSend({ ...base, removalsToday: DEFAULT_GUARD_CONFIG.maxRemovalsPerDay });
  assert.equal(!r.ok && r.pauseCampaign, true);
});

test("csv: ponto e vírgula, aspas, acentos e sinais múltiplos", () => {
  const csv = 'Empresa;E-mail;Sinal;Evidência\n"RH Ágil; Ltda";ana@rhagil.com;SEM_ATS|VOLUME_ALTO;"Vaga ""Dev Java"" por e-mail"\n';
  const rows = parseCsv(csv);
  assert.equal(rows.length, 1);
  const p = rowToProspect(rows[0], now);
  assert.equal(p?.company, "RH Ágil; Ltda");
  assert.equal(p?.email, "ana@rhagil.com");
  assert.deepEqual(p?.signals.map((s) => s.type), ["SEM_ATS", "VOLUME_ALTO"]);
  assert.equal(p?.signals[0].evidenceText, 'Vaga "Dev Java" por e-mail');
});

test("e-mail: remove texto citado", () => {
  const t = "Tenho interesse sim!\n\nEm ter., 10 de nov. de 2026 às 10:00, Danilo escreveu:\n> Oi Ana";
  assert.equal(stripQuoted(t), "Tenho interesse sim!");
});

test("aquecimento: 5 no 1º dia, +2 por dia de envio, teto no limite", async () => {
  const { effectiveDailyLimit } = await import("@/lib/guard");
  const cfg = { ...DEFAULT_GUARD_CONFIG, warmupStart: "2026-11-17" }; // terça
  assert.equal(effectiveDailyLimit(new Date("2026-11-16T13:00:00Z"), cfg), 0); // antes do início
  assert.equal(effectiveDailyLimit(new Date("2026-11-17T13:00:00Z"), cfg), 5);
  assert.equal(effectiveDailyLimit(new Date("2026-11-18T13:00:00Z"), cfg), 7);
  assert.equal(effectiveDailyLimit(new Date("2026-11-24T13:00:00Z"), cfg), 11); // ter,qua,qui + ter = 3 dias antes
  assert.equal(effectiveDailyLimit(new Date("2027-01-12T13:00:00Z"), cfg), 20);
  assert.equal(checkSend({ ...base, now: new Date("2026-11-17T13:00:00Z"), sentFirstTouchesToday: 5 }, cfg).ok, false);
});
