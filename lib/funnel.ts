// Funil de vendas do nRecruit: estágios, sinais de intenção e score ICP.
// Arquivo puro (sem banco) para ser usado pelo painel, pelo worker e pelos testes.

export const STAGES = [
  "DESCOBERTO",
  "ENRIQUECIDO",
  "QUALIFICADO",
  "CONTATADO",
  "RESPONDEU",
  "CONVERSA",
  "TRIAL",
  "ATIVADO",
  "PAGANTE",
  "INDICACAO",
] as const;

export const EXIT_STAGES = ["DESCARTADO", "REMOVER", "PERDIDO"] as const;

export type Stage = (typeof STAGES)[number];
export type ExitStage = (typeof EXIT_STAGES)[number];
export type AnyStage = Stage | ExitStage;

export const ALL_STAGES: readonly AnyStage[] = [...STAGES, ...EXIT_STAGES];

export const STAGE_LABELS: Record<AnyStage, string> = {
  DESCOBERTO: "Descoberto",
  ENRIQUECIDO: "Enriquecido",
  QUALIFICADO: "Qualificado",
  CONTATADO: "Contatado",
  RESPONDEU: "Respondeu",
  CONVERSA: "Conversa",
  TRIAL: "Trial criado",
  ATIVADO: "Ativado",
  PAGANTE: "Pagante",
  INDICACAO: "Indicação",
  DESCARTADO: "Descartado",
  REMOVER: "Remover",
  PERDIDO: "Perdido",
};

/** Como cada estágio age: sozinho, pedindo aprovação ou parado. */
export type StageMode = "AUTO" | "APROVAR" | "DESLIGADO";

export const DEFAULT_STAGE_MODES: Record<Stage, StageMode> = {
  DESCOBERTO: "AUTO",
  ENRIQUECIDO: "AUTO",
  QUALIFICADO: "APROVAR",
  CONTATADO: "APROVAR",
  RESPONDEU: "APROVAR",
  CONVERSA: "APROVAR",
  TRIAL: "APROVAR",
  ATIVADO: "APROVAR",
  PAGANTE: "APROVAR",
  INDICACAO: "APROVAR",
};

/** Sinais de intenção (seção "Fontes de leads" do doc de arquitetura). */
export const SIGNALS = [
  "SEM_ATS", // vaga pedindo CV por e-mail/WhatsApp/Google Forms
  "VOLUME_ALTO", // 5+ vagas abertas na semana
  "EMPRESA_NOVA", // CNPJ de recrutamento aberto há < 60 dias
  "CONTRATANDO_RECRUTADOR",
  "INSATISFEITO_CONCORRENTE",
] as const;

export type Signal = (typeof SIGNALS)[number];

export const SIGNAL_LABELS: Record<Signal, string> = {
  SEM_ATS: "Recruta sem ATS",
  VOLUME_ALTO: "Volume alto agora",
  EMPRESA_NOVA: "Empresa nova",
  CONTRATANDO_RECRUTADOR: "Contratando recrutador",
  INSATISFEITO_CONCORRENTE: "Insatisfeito com concorrente",
};

const SIGNAL_POINTS: Record<Signal, number> = {
  SEM_ATS: 40,
  VOLUME_ALTO: 25,
  EMPRESA_NOVA: 25,
  CONTRATANDO_RECRUTADOR: 20,
  INSATISFEITO_CONCORRENTE: 30,
};

export const SIGNAL_MAX_AGE_DAYS = 14;
export const QUALIFY_MIN_SCORE = 60;

export interface ProspectSignal {
  type: Signal;
  seenAt: Date;
  evidenceUrl?: string;
  evidenceText?: string;
}

export interface ScoreInput {
  signals: ProspectSignal[];
  teamSize?: number;
  /** e-mail do dono/decisor (pessoal ou nome.sobrenome@), não caixa genérica */
  hasPersonalEmail: boolean;
  isRecruitmentCompany: boolean;
}

const GENERIC_MAILBOX =
  /^(contato|comercial|rh|vagas|curriculos?|cv|atendimento|financeiro|adm|administrativo|info|sac|suporte|vendas|recrutamento|selecao|trabalheconosco|jobs|hr|hello|ola|faleconosco|noreply|no-reply)[._-]?\d*@/i;

export function isPersonalEmail(email: string | undefined): boolean {
  if (!email) return false;
  return !GENERIC_MAILBOX.test(email.trim());
}

export function freshSignals(signals: ProspectSignal[], now = new Date()): ProspectSignal[] {
  const limit = now.getTime() - SIGNAL_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return signals.filter((s) => new Date(s.seenAt).getTime() >= limit);
}

/** Score ICP 0..100. Sem nenhum sinal recente o score é 0 (lead descartado). */
export function scoreProspect(input: ScoreInput, now = new Date()): number {
  const fresh = freshSignals(input.signals, now);
  if (fresh.length === 0 || !input.isRecruitmentCompany) return 0;

  const uniqueTypes = new Set(fresh.map((s) => s.type));
  let score = 0;
  for (const type of uniqueTypes) score += SIGNAL_POINTS[type];

  if (input.teamSize !== undefined && input.teamSize >= 1 && input.teamSize <= 20) {
    score += 15;
  }
  if (input.hasPersonalEmail) score += 15;

  return Math.min(100, score);
}

/** Ordem do funil: um agente só move do estágio dele para o seguinte ou para uma saída. */
export function canAdvance(from: AnyStage, to: AnyStage): boolean {
  if ((EXIT_STAGES as readonly string[]).includes(from)) return false;
  if ((EXIT_STAGES as readonly string[]).includes(to)) return true;
  const i = STAGES.indexOf(from as Stage);
  const j = STAGES.indexOf(to as Stage);
  return j > i;
}
