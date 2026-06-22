import type { LeadMetadata, LeadSource } from "@/types/lead";
import type { LeadContacts } from "@/types/lead";

interface ScoringInput {
  sources: LeadSource[];
  cnpj?: string;
  contacts: LeadContacts;
  metadata: LeadMetadata;
}

export function calculateLeadScore(input: ScoringInput): number {
  let score = 0;

  const googleRating = input.metadata.google?.rating;
  if (googleRating !== undefined && googleRating >= 4) {
    score += 15;
  }

  const pncpValue = input.metadata.pncp?.value;
  if (pncpValue !== undefined && pncpValue > 100_000) {
    score += 25;
  }

  if (input.cnpj && input.cnpj.replace(/\D/g, "").length === 14) {
    score += 10;
  }

  const hasPhone = Boolean(input.contacts.phone);
  const hasEmail = Boolean(input.contacts.email);
  const hasAddress = Boolean(input.contacts.address);
  if (hasPhone && hasEmail && hasAddress) {
    score += 10;
  } else if ((hasPhone && hasEmail) || (hasPhone && hasAddress)) {
    score += 5;
  }

  const uniqueSources = new Set(input.sources);
  if (uniqueSources.size >= 2) {
    score += 20;
  }

  if (input.metadata.pncp?.bidId) {
    score += 10;
  }

  return Math.min(score, 100);
}
