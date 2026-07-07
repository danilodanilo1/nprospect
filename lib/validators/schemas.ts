import { z } from "zod";

const leadContactsSchema = z.object({
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  address: z.string().optional(),
});

const googleMetadataSchema = z.object({
  rating: z.number().optional(),
  reviews: z.number().optional(),
  types: z.array(z.string()).optional(),
  mapsUrl: z.string().url().optional(),
  businessStatus: z.string().optional(),
});

const pncpMetadataSchema = z.object({
  bidId: z.string().optional(),
  value: z.number().optional(),
  object: z.string().optional(),
  date: z.string().optional(),
  modality: z.string().optional(),
  buyerName: z.string().optional(),
  buyerCity: z.string().optional(),
  buyerState: z.string().optional(),
  publicationDate: z.string().optional(),
  contractNumber: z.string().optional(),
});

const opportunityMetadataSchema = z.object({
  score: z.number(),
  temperature: z.enum(["HOT", "WARM", "COLD", "DISCARDED"]),
  category: z.enum(["CONSTRUCTION", "MATERIALS", "COMPANY", "NOISE", "UNKNOWN"]),
  confidence: z.number(),
  reasons: z.array(z.string()),
  penalties: z.array(z.string()),
  matchedPositiveTerms: z.array(z.string()),
  matchedNegativeTerms: z.array(z.string()),
  estimatedDemand: z.array(z.string()).optional(),
  rejectionReason: z.string().optional(),
});

const cnpjDataMetadataSchema = z.object({
  legalName: z.string().optional(),
  tradeName: z.string().optional(),
  status: z.string().optional(),
  mainCnae: z.string().optional(),
  mainCnaeDescription: z.string().optional(),
  secondaryCnaes: z.array(z.string()).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  size: z.string().optional(),
  sectorMatch: z.enum(["CONSTRUCTION", "RELATED", "NEGATIVE", "UNKNOWN"]).optional(),
});

const leadMetadataSchema = z.object({
  google: googleMetadataSchema.optional(),
  pncp: pncpMetadataSchema.optional(),
  opportunity: opportunityMetadataSchema.optional(),
  cnpjData: cnpjDataMetadataSchema.optional(),
  scraper: z.record(z.string(), z.unknown()).optional(),
  aiSummary: z.string().optional(),
  aiPitch: z.string().optional(),
  aiQualifiedAt: z.string().optional(),
});

export const ingestionLeadSchema = z.object({
  name: z.string().min(1),
  cnpj: z.string().optional(),
  contacts: leadContactsSchema.optional(),
  source: z.enum(["GOOGLE_PLACES", "PNCP_BID", "SCRAPER"]),
  placeId: z.string().optional(),
  metadata: leadMetadataSchema.optional(),
  prospectingJobId: z.string().optional(),
});

export const leadsIngestionSchema = z.object({
  jobId: z.string().optional(),
  leads: z.array(ingestionLeadSchema).min(1),
});

export const scraperResultSchema = z.object({
  jobId: z.string().optional(),
  url: z.string().url(),
  data: z.record(z.string(), z.unknown()),
  lead: ingestionLeadSchema.optional(),
});

export const leadCreateSchema = z.object({
  name: z.string().min(1),
  cnpj: z.string().optional(),
  contacts: leadContactsSchema.optional(),
  status: z
    .enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"])
    .optional(),
  notes: z.string().optional(),
});

export const leadUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  cnpj: z.string().optional(),
  contacts: leadContactsSchema.optional(),
  status: z
    .enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"])
    .optional(),
  notes: z.string().optional(),
});

export const prospectingSearchSchema = z.object({
  region: z.string().min(1).optional(),
  radiusKm: z.number().min(1).max(100).optional(),
  keywords: z.array(z.string()).optional(),
  pncpObject: z.string().optional(),
  dateFrom: z.string().regex(/^\d{8}$/).optional(),
  dateTo: z.string().regex(/^\d{8}$/).optional(),
  minValue: z.number().min(0).optional(),
  sources: z.array(z.enum(["GOOGLE_PLACES", "PNCP_BID"])).optional(),
});
