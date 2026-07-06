export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL"
  | "WON"
  | "LOST";

export type LeadSource = "GOOGLE_PLACES" | "PNCP_BID" | "SCRAPER";

export interface LeadContacts {
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
}

export interface GoogleMetadata {
  rating?: number;
  reviews?: number;
  types?: string[];
  mapsUrl?: string;
  businessStatus?: string;
}

export interface PncpMetadata {
  bidId?: string;
  value?: number;
  object?: string;
  date?: string;
  modality?: string;
  buyerName?: string;
  buyerCity?: string;
  buyerState?: string;
  publicationDate?: string;
  contractNumber?: string;
}

export interface LeadMetadata {
  google?: GoogleMetadata;
  pncp?: PncpMetadata;
  scraper?: Record<string, unknown>;
  aiSummary?: string;
  aiPitch?: string;
  aiQualifiedAt?: string;
}

export interface LeadNote {
  _id?: string;
  content: string;
  createdAt: string;
  createdBy?: string;
}

export interface LeadDTO {
  _id: string;
  name: string;
  cnpj?: string;
  contacts: LeadContacts;
  status: LeadStatus;
  score: number;
  sources: LeadSource[];
  placeId?: string;
  metadata: LeadMetadata;
  notes: LeadNote[];
  assignedTo?: string;
  prospectingJobs?: string[];
  lastProspectingJobId?: string;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Novo",
  CONTACTED: "Contatado",
  QUALIFIED: "Qualificado",
  PROPOSAL: "Proposta",
  WON: "Ganho",
  LOST: "Perdido",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  GOOGLE_PLACES: "Google Places",
  PNCP_BID: "PNCP",
  SCRAPER: "Scraper",
};
