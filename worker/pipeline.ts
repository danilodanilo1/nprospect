// Um "tick" do worker: roda cada agente uma vez. Dependências externas (e-mail, IA)
// entram por parâmetro para os testes rodarem sem rede.
import type { Types } from "mongoose";
import Prospect, { type IProspect } from "@/models/Prospect";
import Interaction, { type IInteraction, type ReplyClass } from "@/models/Interaction";
import SystemState, { getSystemState, type ISystemState } from "@/models/SystemState";
import { isSuppressed } from "@/models/Suppression";
import { QUALIFY_MIN_SCORE, isPersonalEmail, scoreProspect, type Stage } from "@/lib/funnel";
import { checkSend, type GuardConfig } from "@/lib/guard";
import { logEvent, moveStage, removeProspect, setRunning, upsertProspects } from "@/services/prospect.service";
import type { Collector } from "@/collectors/types";
import { CollectorBlocked } from "@/collectors/types";
import {
  PROMPT_VERSION,
  REPLY_CLASSES,
  classifyPrompt,
  closerPrompt,
  fallbackFirstTouch,
  firstTouchPrompt,
  followUpPrompt,
} from "@/prompts";
import type { LlmRequest, LlmResponse } from "@/services/llm-router";
import { parseJson } from "@/services/llm-router";
import { addressesIn, type IncomingMail, type OutgoingMail } from "@/services/mailer";

export interface Deps {
  now: () => Date;
  llm: (req: LlmRequest) => Promise<LlmResponse>;
  send: (mail: OutgoingMail) => Promise<string>;
  fetchMail: (sinceUid: number) => Promise<IncomingMail[]>;
  mailEnabled: boolean;
  guard: GuardConfig;
  signupUrl: string;
  /** dias entre toques: [follow-up 1, follow-up 2, desistir] */
  cadenceDays: [number, number, number];
  collectors: Collector[];
}

export interface TickReport {
  running: boolean;
  collected: number;
  qualified: number;
  discarded: number;
  drafted: number;
  sent: number;
  blocked: number;
  received: number;
  lost: number;
  errors: string[];
}

const DAY = 24 * 60 * 60 * 1000;
const MAX_PER_TICK = 25;

const activeFilter = { owner: "IA" as const, paused: false };

function modeOf(state: ISystemState, stage: Stage) {
  return state.stageModes[stage] ?? "APROVAR";
}

function brief(p: IProspect) {
  return { company: p.company, contactName: p.contactName, city: p.city, signals: p.signals };
}

// ---------- Caçador: roda os coletores no intervalo de cada um ----------
async function hunt(state: ISystemState, deps: Deps, r: TickReport) {
  if (modeOf(state, "DESCOBERTO") === "DESLIGADO") return;
  const runs = { ...(state.collectorRuns ?? {}) };
  for (const c of deps.collectors) {
    const last = runs[c.name] ? new Date(runs[c.name]).getTime() : 0;
    if (deps.now().getTime() - last < c.everyHours * 60 * 60 * 1000) continue;
    runs[c.name] = deps.now();
    await SystemState.updateOne({ _id: "system" }, { $set: { [`collectorRuns.${c.name}`]: deps.now() } });
    try {
      const rows = await c.run({ now: deps.now(), sleep: (ms) => new Promise((res) => setTimeout(res, ms)), log: () => {} });
      const res = await upsertProspects(rows, c.name);
      r.collected += res.created;
    } catch (err) {
      const blocked = err instanceof CollectorBlocked;
      r.errors.push(`Coletor ${c.name}${blocked ? " bloqueado (pausado até a próxima janela)" : ""}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// ---------- Qualificador ----------
async function qualify(state: ISystemState, deps: Deps, r: TickReport) {
  if (modeOf(state, "DESCOBERTO") === "DESLIGADO") return;
  const list = await Prospect.find({ ...activeFilter, stage: { $in: ["DESCOBERTO", "ENRIQUECIDO"] } }).limit(MAX_PER_TICK * 4);
  for (const p of list) {
    const score = scoreProspect(
      {
        signals: p.signals,
        teamSize: p.teamSize,
        hasPersonalEmail: isPersonalEmail(p.email),
        isRecruitmentCompany: p.isRecruitmentCompany,
      },
      deps.now(),
    );
    p.score = score;
    await p.save();
    if (!p.email) {
      await moveStage(p, "DESCARTADO", "sem e-mail para contato");
      r.discarded++;
    } else if (await isSuppressed(p.email)) {
      await moveStage(p, "REMOVER", "e-mail na lista de bloqueio");
      r.discarded++;
    } else if (score >= QUALIFY_MIN_SCORE) {
      await moveStage(p, "QUALIFICADO", `score ${score} (mínimo ${QUALIFY_MIN_SCORE})`);
      r.qualified++;
    } else {
      await moveStage(p, "DESCARTADO", `score ${score}: sem sinal de intenção recente suficiente`);
      r.discarded++;
    }
  }
}

async function hasOpenOutbound(p: IProspect) {
  return Boolean(
    await Interaction.exists({ prospect: p._id, direction: "OUT", status: { $in: ["PENDENTE", "AGENDADA"] } }),
  );
}

function draftStatus(mode: string): IInteraction["status"] {
  return mode === "AUTO" ? "AGENDADA" : "PENDENTE";
}

// ---------- Redator: primeiro contato ----------
async function draftFirstTouches(state: ISystemState, deps: Deps, r: TickReport) {
  const mode = modeOf(state, "CONTATADO");
  if (mode === "DESLIGADO") return;
  const list = await Prospect.find({ ...activeFilter, stage: "QUALIFICADO", touches: 0 }).sort({ score: -1 }).limit(MAX_PER_TICK);
  for (const p of list) {
    if (await hasOpenOutbound(p)) continue;
    const prompt = firstTouchPrompt(brief(p));
    let subject: string;
    let body: string;
    let model = "modelo-fixo";
    let tokens: number | undefined;
    try {
      const res = await deps.llm({ ...prompt, purpose: "write", json: true });
      const parsed = parseJson<{ subject?: string; body?: string }>(res.text);
      if (!parsed.subject || !parsed.body) throw new Error("JSON sem subject/body");
      subject = parsed.subject;
      body = parsed.body;
      model = res.model;
      tokens = res.tokens;
    } catch (err) {
      ({ subject, body } = fallbackFirstTouch(brief(p)));
      r.errors.push(`IA no redator (${p.company}): ${err instanceof Error ? err.message : String(err)}; usei texto fixo`);
    }
    await Interaction.create({
      prospect: p._id,
      channel: "EMAIL",
      direction: "OUT",
      author: "IA",
      status: draftStatus(mode),
      kind: "primeiro-contato",
      subject,
      body,
      reason: `Score ${p.score}; sinais: ${p.signals.map((s) => s.type).join(", ")}`,
      prompt: `${PROMPT_VERSION}\n${prompt.system}\n---\n${prompt.prompt}`,
      aiModel: model,
      tokens,
      firstTouch: true,
      scheduledFor: deps.now(),
    });
    r.drafted++;
  }
}

// ---------- Redator: follow-ups na mesma conversa ----------
async function draftFollowUps(state: ISystemState, deps: Deps, r: TickReport) {
  const mode = modeOf(state, "CONTATADO");
  if (mode === "DESLIGADO") return;
  const now = deps.now();
  const due = await Prospect.find({ ...activeFilter, stage: "CONTATADO", nextActionAt: { $lte: now } }).limit(MAX_PER_TICK);
  for (const p of due) {
    if (await hasOpenOutbound(p)) continue;
    if (p.touches >= 3) {
      p.nextActionAt = undefined;
      await moveStage(p, "PERDIDO", "3 toques sem resposta");
      r.lost++;
      continue;
    }
    const last = await Interaction.findOne({ prospect: p._id, direction: "OUT", status: "ENVIADA" }).sort({ sentAt: -1 });
    const n = p.touches; // touches=1 → follow-up 1
    const prompt = followUpPrompt(brief(p), n, last?.body ?? "");
    let body: string;
    let model = "modelo-fixo";
    try {
      const res = await deps.llm({ ...prompt, purpose: "write", json: true });
      body = parseJson<{ body: string }>(res.text).body;
      if (!body) throw new Error("JSON sem body");
      model = res.model;
    } catch {
      body = `Oi${p.contactName ? `, ${p.contactName.split(" ")[0]}` : ""}! Só subindo minha mensagem anterior. Se organizar candidatos ainda é um problema aí, posso te mostrar em 10 minutos?\n\nDanilo, nRecruit\n\nSe não fizer sentido, responda 'remover' que eu não escrevo mais.`;
    }
    await Interaction.create({
      prospect: p._id,
      channel: "EMAIL",
      direction: "OUT",
      author: "IA",
      status: draftStatus(mode),
      kind: `follow-up-${n}`,
      subject: p.threadSubject ? `Re: ${p.threadSubject.replace(/^re:\s*/i, "")}` : "Re:",
      body,
      reason: `Sem resposta desde ${p.lastTouchAt?.toISOString().slice(0, 10) ?? "?"}`,
      prompt: `${PROMPT_VERSION}\n${prompt.system}\n---\n${prompt.prompt}`,
      aiModel: model,
      inReplyTo: p.threadMessageId,
      firstTouch: false,
      scheduledFor: now,
    });
    p.nextActionAt = undefined;
    await p.save();
    r.drafted++;
  }
}

// ---------- Disparador (com Guarda) ----------
async function dispatch(state: ISystemState, deps: Deps, r: TickReport) {
  if (!deps.mailEnabled) return;
  const now = deps.now();
  const queue = await Interaction.find({ status: "AGENDADA", direction: "OUT", channel: "EMAIL", scheduledFor: { $lte: now } })
    .sort({ firstTouch: 1, scheduledFor: 1 })
    .limit(MAX_PER_TICK);
  for (const msg of queue) {
    const fresh = await SystemState.findById("system").lean();
    if (!fresh?.running) return; // desligaram no meio do tick
    const p = await Prospect.findById(msg.prospect);
    if (!p || !p.email) {
      msg.status = "ERRO";
      msg.error = "Lead sem e-mail";
      await msg.save();
      continue;
    }
    const since24h = new Date(now.getTime() - DAY);
    const since7d = new Date(now.getTime() - 7 * DAY);
    const [sentFirstTouchesToday, sentLast7Days, bouncesLast7Days, removalsToday, suppressed] = await Promise.all([
      Interaction.countDocuments({ status: "ENVIADA", firstTouch: true, sentAt: { $gte: since24h } }),
      Interaction.countDocuments({ status: "ENVIADA", direction: "OUT", sentAt: { $gte: since7d } }),
      Interaction.countDocuments({ replyClass: "BOUNCE", createdAt: { $gte: since7d } }),
      Interaction.countDocuments({ replyClass: "REMOVER", createdAt: { $gte: since24h } }),
      isSuppressed(p.email),
    ]);
    const verdict = checkSend(
      {
        now,
        systemRunning: true,
        ownerIsHuman: p.owner === "HUMANO" && msg.author === "IA",
        suppressed,
        isFirstTouch: msg.firstTouch,
        isReplyToInbound: msg.kind === "resposta" || msg.author === "HUMANO",
        sentFirstTouchesToday,
        sentLast7Days,
        bouncesLast7Days,
        removalsToday,
      },
      deps.guard,
    );
    if (!verdict.ok) {
      if (verdict.pauseCampaign) {
        await setRunning(false, "Guarda", verdict.reason);
        await logEvent(p._id as Types.ObjectId, "guarda-pausou", `Sistema desligado pelo Guarda: ${verdict.reason}`);
        r.blocked++;
        return;
      }
      if (suppressed || (p.owner === "HUMANO" && msg.author === "IA")) {
        msg.status = "BLOQUEADA";
        msg.error = verdict.reason;
        await msg.save();
      }
      r.blocked++;
      // limite, dia ou horário: fica AGENDADA e tenta no próximo tick
      continue;
    }
    try {
      const messageId = await deps.send({
        to: p.email,
        subject: msg.subject ?? p.threadSubject ?? "",
        body: msg.body,
        inReplyTo: msg.inReplyTo,
        references: msg.inReplyTo,
      });
      msg.status = "ENVIADA";
      msg.sentAt = deps.now();
      msg.messageId = messageId;
      await msg.save();
      p.touches += 1;
      p.lastTouchAt = msg.sentAt;
      if (msg.firstTouch) {
        p.threadMessageId = messageId;
        p.threadSubject = msg.subject;
      }
      if (msg.kind !== "resposta") {
        const wait = deps.cadenceDays[Math.min(p.touches - 1, 2)];
        p.nextActionAt = new Date(msg.sentAt.getTime() + wait * DAY);
      }
      await p.save();
      if (p.stage === "QUALIFICADO") await moveStage(p, "CONTATADO", "1º e-mail enviado");
      r.sent++;
    } catch (err) {
      msg.status = "ERRO";
      msg.error = err instanceof Error ? err.message : String(err);
      await msg.save();
      r.errors.push(`Envio para ${p.email}: ${msg.error}`);
    }
  }
}

// ---------- Leitor de respostas + Closer ----------
async function findProspectFor(mail: IncomingMail): Promise<IProspect | null> {
  const ids = [mail.inReplyTo, ...mail.references].filter(Boolean) as string[];
  if (ids.length) {
    const out = await Interaction.findOne({ messageId: { $in: ids }, direction: "OUT" });
    if (out) return Prospect.findById(out.prospect);
  }
  return Prospect.findOne({ email: mail.from });
}

async function readInbox(state: ISystemState, deps: Deps, r: TickReport) {
  if (!deps.mailEnabled) return;
  const mails = await deps.fetchMail(state.imapLastUid ?? 0);
  let maxUid = state.imapLastUid ?? 0;
  for (const mail of mails) {
    maxUid = Math.max(maxUid, mail.uid);
    if (mail.isBounce) {
      const p = await Prospect.findOne({ email: { $in: addressesIn(mail.text) } });
      if (p) {
        await Interaction.create({
          prospect: p._id, channel: "EMAIL", direction: "IN", author: "SISTEMA", status: "RECEBIDA",
          kind: "bounce", subject: mail.subject, body: mail.text.slice(0, 2000), replyClass: "BOUNCE", messageId: mail.messageId,
        });
        p.nextActionAt = undefined;
        await p.save();
        await moveStage(p, "DESCARTADO", "e-mail voltou (bounce)", "SISTEMA");
      }
      continue;
    }
    const p = await findProspectFor(mail);
    if (!p) continue; // e-mail que não é de lead: o sistema não mexe
    if (mail.messageId && (await Interaction.exists({ messageId: mail.messageId }))) continue;

    let replyClass: ReplyClass = "AMBIGUA";
    let summary = "";
    try {
      const res = await deps.llm({ ...classifyPrompt(mail.text), purpose: "classify", json: true });
      const parsed = parseJson<{ class: string; confidence?: number; summary?: string }>(res.text);
      const cls = parsed.class?.toUpperCase();
      if ((REPLY_CLASSES as readonly string[]).includes(cls) && (parsed.confidence ?? 1) >= 0.6) replyClass = cls as ReplyClass;
      summary = parsed.summary ?? "";
    } catch {
      if (/\b(remover|descadastr|pare de|não quero receber|nao quero receber|unsubscribe)\b/i.test(mail.text)) replyClass = "REMOVER";
    }

    await Interaction.create({
      prospect: p._id, channel: "EMAIL", direction: "IN", author: "LEAD", status: "RECEBIDA", kind: "resposta-lead",
      subject: mail.subject, body: mail.text, replyClass, reason: summary, messageId: mail.messageId, inReplyTo: mail.inReplyTo,
    });
    r.received++;
    p.lastInboundAt = mail.date;
    p.nextActionAt = undefined;
    await p.save();
    await Interaction.updateMany(
      { prospect: p._id, direction: "OUT", status: { $in: ["PENDENTE", "AGENDADA"] }, kind: /^follow-up/ },
      { $set: { status: "REJEITADA", error: "Lead respondeu" } },
    );

    if (replyClass === "REMOVER") {
      await removeProspect(p, "pediu para não receber mais", "LEAD");
      continue;
    }
    if (["QUALIFICADO", "CONTATADO"].includes(p.stage)) await moveStage(p, "RESPONDEU", `respondeu (${replyClass})`, "LEAD");
    if (p.owner === "HUMANO" || p.paused) continue; // humano no controle: só registra
    if (replyClass === "NAO_AGORA") {
      await moveStage(p, "PERDIDO", "pediu para falar mais tarde; volta em 90 dias com sinal novo", "LEAD");
      continue;
    }
    const mode = modeOf(state, "RESPONDEU");
    if (mode === "DESLIGADO") continue;

    const history = (await Interaction.find({ prospect: p._id, channel: "EMAIL", status: { $in: ["ENVIADA", "RECEBIDA"] } }).sort({ createdAt: 1 }))
      .map((i) => `${i.direction === "IN" ? "LEAD" : "NÓS"}: ${i.body}`)
      .join("\n\n");
    const prompt = closerPrompt(brief(p), history, deps.signupUrl);
    let body = "";
    let model = "";
    try {
      const res = await deps.llm({ ...prompt, purpose: "write", json: true });
      body = parseJson<{ body: string }>(res.text).body ?? "";
      model = res.model;
    } catch (err) {
      r.errors.push(`IA no closer (${p.company}): ${err instanceof Error ? err.message : String(err)}`);
    }
    const mustReview = replyClass === "AMBIGUA" || !body;
    await Interaction.create({
      prospect: p._id, channel: "EMAIL", direction: "OUT", author: "IA",
      status: mustReview ? "PENDENTE" : draftStatus(mode),
      kind: "resposta",
      subject: mail.subject.match(/^re:/i) ? mail.subject : `Re: ${mail.subject}`,
      body: body || "(A IA não conseguiu redigir. Escreva a resposta.)",
      reason: mustReview ? `Resposta ${replyClass === "AMBIGUA" ? "ambígua ou irritada" : "sem rascunho"}: precisa de humano` : `Resposta classificada como ${replyClass}`,
      prompt: `${PROMPT_VERSION}\n${prompt.system}\n---\n${prompt.prompt}`,
      aiModel: model, inReplyTo: mail.messageId, firstTouch: false, scheduledFor: deps.now(),
    });
    r.drafted++;
  }
  if (maxUid !== (state.imapLastUid ?? 0)) await SystemState.updateOne({ _id: "system" }, { $set: { imapLastUid: maxUid } });
}

export async function tick(deps: Deps): Promise<TickReport> {
  const r: TickReport = { running: false, collected: 0, qualified: 0, discarded: 0, drafted: 0, sent: 0, blocked: 0, received: 0, lost: 0, errors: [] };
  await SystemState.updateOne({ _id: "system" }, { $set: { workerHeartbeatAt: deps.now() } }, { upsert: true });
  const state = await getSystemState();
  r.running = state.running;

  // Ler a caixa não envia nada: roda mesmo desligado, para o log ficar completo.
  try {
    await readInbox(state, deps, r);
  } catch (err) {
    r.errors.push(`Leitura da caixa: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!state.running) return r;

  const steps: Array<[string, (s: ISystemState, d: Deps, r: TickReport) => Promise<void>]> = [
    ["cacador", hunt],
    ["qualificador", qualify],
    ["redator", draftFirstTouches],
    ["follow-up", draftFollowUps],
    ["disparador", dispatch],
  ];
  for (const [name, step] of steps) {
    const fresh = await getSystemState();
    if (!fresh.running) break;
    try {
      await step(fresh, deps, r);
    } catch (err) {
      r.errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return r;
}
