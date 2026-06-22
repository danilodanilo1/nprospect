import type { LeadSource, LeadContacts, LeadMetadata } from "./lead";

export interface IngestionLeadPayload {
  name: string;
  cnpj?: string;
  contacts?: LeadContacts;
  source: LeadSource;
  placeId?: string;
  metadata?: LeadMetadata;
}

export interface LeadsIngestionPayload {
  jobId?: string;
  leads: IngestionLeadPayload[];
}

export interface ScraperResultPayload {
  jobId?: string;
  url: string;
  data: Record<string, unknown>;
  lead?: IngestionLeadPayload;
}
