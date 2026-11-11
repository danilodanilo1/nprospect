// Agente Guarda: regras puras que rodam antes de TODO envio.
// Nenhum envio sai se qualquer regra disser "não".

export interface GuardConfig {
  dailyLimit: number; // novos contatos por caixa por dia
  /** dias da semana permitidos (0=dom … 6=sáb) */
  allowedWeekdays: number[];
  startHour: number; // inclusive, horário local
  endHour: number; // exclusive
  timeZone: string;
  maxBounceRate: number; // 0.03 = 3%
  maxRemovalsPerDay: number;
}

export const DEFAULT_GUARD_CONFIG: GuardConfig = {
  dailyLimit: 20,
  allowedWeekdays: [2, 3, 4], // ter, qua, qui
  startHour: 9,
  endHour: 11,
  timeZone: "America/Sao_Paulo",
  maxBounceRate: 0.03,
  maxRemovalsPerDay: 2,
};

export interface GuardContext {
  now: Date;
  systemRunning: boolean;
  ownerIsHuman: boolean;
  suppressed: boolean;
  /** primeiro contato conta no limite diário; follow-up e resposta não */
  isFirstTouch: boolean;
  /** resposta a quem escreveu: pode sair fora da janela */
  isReplyToInbound: boolean;
  sentFirstTouchesToday: number;
  sentLast7Days: number;
  bouncesLast7Days: number;
  removalsToday: number;
}

export type GuardResult =
  | { ok: true }
  | { ok: false; reason: string; pauseCampaign?: boolean };

export function localParts(date: Date, timeZone: string): { weekday: number; hour: number; day: string } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return {
    weekday,
    hour: Number(parts.hour),
    day: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

export function checkSend(ctx: GuardContext, cfg: GuardConfig = DEFAULT_GUARD_CONFIG): GuardResult {
  if (!ctx.systemRunning) return { ok: false, reason: "Sistema desligado" };
  if (ctx.ownerIsHuman) return { ok: false, reason: "Lead assumido por humano" };
  if (ctx.suppressed) return { ok: false, reason: "Contato na lista de bloqueio" };

  if (ctx.sentLast7Days >= 20 && ctx.bouncesLast7Days / ctx.sentLast7Days > cfg.maxBounceRate) {
    return {
      ok: false,
      reason: `Bounce acima de ${Math.round(cfg.maxBounceRate * 100)}% nos últimos 7 dias`,
      pauseCampaign: true,
    };
  }
  if (ctx.removalsToday >= cfg.maxRemovalsPerDay) {
    return { ok: false, reason: `${ctx.removalsToday} pedidos de remoção hoje`, pauseCampaign: true };
  }

  if (!ctx.isReplyToInbound) {
    const { weekday, hour } = localParts(ctx.now, cfg.timeZone);
    if (!cfg.allowedWeekdays.includes(weekday)) return { ok: false, reason: "Fora dos dias de envio" };
    if (hour < cfg.startHour || hour >= cfg.endHour) return { ok: false, reason: "Fora do horário de envio" };
  }

  if (ctx.isFirstTouch && ctx.sentFirstTouchesToday >= cfg.dailyLimit) {
    return { ok: false, reason: `Limite de ${cfg.dailyLimit} novos contatos por dia atingido` };
  }

  return { ok: true };
}

export function guardConfigFromEnv(env: NodeJS.ProcessEnv = process.env): GuardConfig {
  const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);
  return {
    dailyLimit: num(env.SEND_DAILY_LIMIT, DEFAULT_GUARD_CONFIG.dailyLimit),
    allowedWeekdays: env.SEND_WEEKDAYS
      ? env.SEND_WEEKDAYS.split(",").map((d) => Number(d.trim()))
      : DEFAULT_GUARD_CONFIG.allowedWeekdays,
    startHour: num(env.SEND_START_HOUR, DEFAULT_GUARD_CONFIG.startHour),
    endHour: num(env.SEND_END_HOUR, DEFAULT_GUARD_CONFIG.endHour),
    timeZone: env.SEND_TIMEZONE ?? DEFAULT_GUARD_CONFIG.timeZone,
    maxBounceRate: num(env.MAX_BOUNCE_RATE, DEFAULT_GUARD_CONFIG.maxBounceRate),
    maxRemovalsPerDay: num(env.MAX_REMOVALS_PER_DAY, DEFAULT_GUARD_CONFIG.maxRemovalsPerDay),
  };
}
