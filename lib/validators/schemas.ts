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
});

const pncpMetadataSchema = z.object({
  bidId: z.string().optional(),
  value: z.number().optional(),
  object: z.string().optional(),
  date: z.string().optional(),
  modality: z.string().optional(),
});

const leadMetadataSchema = z.object({
  google: googleMetadataSchema.optional(),
  pncp: pncpMetadataSchema.optional(),
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
  sources: z.array(z.enum(["GOOGLE_PLACES", "PNCP_BID"])).optional(),
});
