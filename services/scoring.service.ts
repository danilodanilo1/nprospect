import type { LeadMetadata, LeadSource } from "@/types/lead";
import type { LeadContacts } from "@/types/lead";
import {
  classifyOpportunityText,
  temperatureFromScore,
  type OpportunityScoreResult,
} from "@/services/opportunity-rules.service";

interface ScoringInput {
  sources: LeadSource[];
  cnpj?: string;
  contacts: LeadContacts;
  metadata: LeadMetadata;
}

function isRecentDate(date: string | undefined): boolean {
  if (!date) return false;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return false;
  const diff = Date.now() - parsed.getTime();
  return diff >= 0 && diff <= 1000 * 60 * 60 * 24 * 30;
}

export function calculateOpportunityScore(
  input: ScoringInput,
): OpportunityScoreResult {
  let score = 0;
  const reasons: string[] = [];
  const penalties: string[] = [];
  const pncpObject = input.metadata.pncp?.object ?? "";
  const textClassification =
    input.metadata.opportunity ?? classifyOpportunityText(pncpObject);
  const cnpjData = input.metadata.cnpjData;

  if (cnpjData?.sectorMatch === "CONSTRUCTION") {
    score += 35;
    reasons.push("CNAE indica construção, engenharia ou obras");
  } else if (cnpjData?.sectorMatch === "NEGATIVE") {
    score -= 50;
    penalties.push("CNAE indica atividade fora do setor de construção");
  }

  if (textClassification.category === "CONSTRUCTION") {
    score += 30;
    reasons.push("Objeto indica obra, reforma ou construção");
  } else if (textClassification.category === "MATERIALS") {
    score += 18;
    reasons.push("Objeto indica material útil para construção");
  } else if (textClassification.category === "COMPANY") {
    score += 20;
    reasons.push("Empresa atua em segmento-alvo de construção");
  }

  const googleRating = input.metadata.google?.rating;
  if (googleRating !== undefined && googleRating >= 4) {
    score += 10;
    reasons.push("Empresa bem avaliada no Google");
  }

  const pncpValue = input.metadata.pncp?.value;
  if (pncpValue !== undefined && pncpValue > 500_000) {
    score += 30;
    reasons.push("Contrato acima de R$ 500 mil");
  } else if (pncpValue !== undefined && pncpValue > 100_000) {
    score += 20;
    reasons.push("Contrato acima de R$ 100 mil");
  } else if (pncpValue !== undefined && pncpValue < 10_000) {
    score -= 30;
    penalties.push("Contrato abaixo de R$ 10 mil");
  }

  if (input.cnpj && input.cnpj.replace(/\D/g, "").length === 14) {
    score += 10;
    reasons.push("CNPJ válido disponível");
  }

  const hasPhone = Boolean(input.contacts.phone);
  const hasEmail = Boolean(input.contacts.email);
  const hasAddress = Boolean(input.contacts.address);
  if (hasPhone && hasEmail && hasAddress) {
    score += 15;
    reasons.push("Contato completo disponível");
  } else if ((hasPhone && hasEmail) || (hasPhone && hasAddress)) {
    score += 8;
    reasons.push("Contato parcial disponível");
  } else if (!hasPhone && !hasEmail) {
    score -= 20;
    penalties.push("Sem telefone ou email disponível");
  }

  const uniqueSources = new Set(input.sources);
  if (uniqueSources.size >= 2) {
    score += 10;
    reasons.push("Empresa apareceu em mais de uma fonte");
  }

  if (input.metadata.pncp?.bidId) {
    score += 10;
    reasons.push("Contrato PNCP confirmado");
  }

  if (
    isRecentDate(input.metadata.pncp?.date) ||
    isRecentDate(input.metadata.pncp?.publicationDate)
  ) {
    score += 10;
    reasons.push("Contrato recente nos últimos 30 dias");
  }

  if (textClassification.matchedNegativeTerms.length > 0) {
    score -= 100;
    penalties.push(
      `Termos negativos encontrados: ${textClassification.matchedNegativeTerms.join(
        ", ",
      )}`,
    );
  }

  const normalizedScore = Math.max(0, Math.min(score, 100));
  const discarded =
    textClassification.category === "NOISE" || normalizedScore < 20;

  return {
    score: normalizedScore,
    temperature: temperatureFromScore(normalizedScore, discarded),
    category: textClassification.category,
    confidence: textClassification.confidence,
    reasons,
    penalties,
    matchedPositiveTerms: textClassification.matchedPositiveTerms,
    matchedNegativeTerms: textClassification.matchedNegativeTerms,
    estimatedDemand: textClassification.estimatedDemand ?? [],
    rejectionReason: discarded
      ? penalties[0] ?? "Score abaixo do mínimo comercial"
      : undefined,
  };
}

export function calculateLeadScore(input: ScoringInput): number {
  return calculateOpportunityScore(input).score;
}
