import mongoose from "mongoose";
import Lead, { type ILead } from "@/models/Lead";
import ProspectingJob from "@/models/ProspectingJob";
import { connectDB } from "@/lib/db";
import { normalizeCnpj } from "@/lib/utils";
import { calculateLeadScore } from "@/services/scoring.service";
import { logActivity } from "@/services/activity-log.service";
import type { IngestionLeadPayload } from "@/types/ingestion";
import type { LeadMetadata, LeadSource } from "@/types/lead";

function mergeMetadata(
  existing: LeadMetadata,
  incoming: LeadMetadata | undefined,
): LeadMetadata {
  if (!incoming) return existing;

  return {
    ...existing,
    google: { ...existing.google, ...incoming.google },
    pncp: { ...existing.pncp, ...incoming.pncp },
    scraper: { ...existing.scraper, ...incoming.scraper },
    aiSummary: incoming.aiSummary ?? existing.aiSummary,
    aiPitch: incoming.aiPitch ?? existing.aiPitch,
    aiQualifiedAt: incoming.aiQualifiedAt ?? existing.aiQualifiedAt,
  };
}

function mergeSources(
  existing: LeadSource[],
  incoming: LeadSource,
): LeadSource[] {
  const set = new Set([...existing, incoming]);
  return Array.from(set);
}

async function findExistingLead(
  payload: IngestionLeadPayload,
): Promise<ILead | null> {
  const normalizedCnpj = normalizeCnpj(payload.cnpj);

  if (normalizedCnpj) {
    const byCnpj = await Lead.findOne({ cnpj: normalizedCnpj });
    if (byCnpj) return byCnpj;
  }

  if (payload.placeId) {
    const byPlace = await Lead.findOne({ placeId: payload.placeId });
    if (byPlace) return byPlace;
  }

  if (payload.contacts?.phone) {
    const phone = payload.contacts.phone.replace(/\D/g, "");
    const byPhone = await Lead.findOne({
      name: { $regex: new RegExp(`^${payload.name.trim()}$`, "i") },
      "contacts.phone": { $regex: phone.slice(-8) },
    });
    if (byPhone) return byPhone;
  }

  return null;
}

export interface UpsertResult {
  lead: ILead;
  created: boolean;
}

export async function upsertLeadFromIngestion(
  payload: IngestionLeadPayload,
): Promise<UpsertResult> {
  await connectDB();

  const normalizedCnpj = normalizeCnpj(payload.cnpj);
  const existing = await findExistingLead(payload);
  const jobObjectId = payload.prospectingJobId
    ? new mongoose.Types.ObjectId(payload.prospectingJobId)
    : undefined;

  if (existing) {
    existing.name = payload.name || existing.name;
    existing.cnpj = normalizedCnpj ?? existing.cnpj;
    existing.contacts = {
      ...existing.contacts,
      ...payload.contacts,
    };
    existing.placeId = payload.placeId ?? existing.placeId;
    existing.sources = mergeSources(existing.sources, payload.source);
    existing.metadata = mergeMetadata(existing.metadata, payload.metadata);
    if (jobObjectId) {
      existing.lastProspectingJobId = jobObjectId;
      const prospectingJobs = existing.prospectingJobs ?? [];
      if (!existing.prospectingJobs) existing.prospectingJobs = prospectingJobs;
      if (
        !prospectingJobs.some(
          (existingJobId) => existingJobId.toString() === jobObjectId.toString(),
        )
      ) {
        existing.prospectingJobs.push(jobObjectId);
      }
    }
    existing.score = calculateLeadScore({
      sources: existing.sources,
      cnpj: existing.cnpj,
      contacts: existing.contacts,
      metadata: existing.metadata,
    });
    existing.lastActivityAt = new Date();
    await existing.save();

    return { lead: existing, created: false };
  }

  const sources = [payload.source];
  const metadata = payload.metadata ?? {};
  const contacts = payload.contacts ?? {};

  const lead = await Lead.create({
    name: payload.name,
    cnpj: normalizedCnpj,
    contacts,
    sources,
    placeId: payload.placeId,
    metadata,
    prospectingJobs: jobObjectId ? [jobObjectId] : [],
    lastProspectingJobId: jobObjectId,
    score: calculateLeadScore({
      sources,
      cnpj: normalizedCnpj,
      contacts,
      metadata,
    }),
    lastActivityAt: new Date(),
  });

  return { lead, created: true };
}

export async function ingestLeadsBatch(
  leads: IngestionLeadPayload[],
  jobId?: string,
): Promise<{ created: number; updated: number; errors: number }> {
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const payload of leads) {
    try {
      const result = await upsertLeadFromIngestion({
        ...payload,
        prospectingJobId: payload.prospectingJobId ?? jobId,
      });
      if (result.created) created += 1;
      else updated += 1;
    } catch (error) {
      errors += 1;
      await logActivity("error", "lead-ingestion", "Falha ao ingerir lead", {
        payload,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  if (jobId) {
    try {
      await ProspectingJob.findByIdAndUpdate(jobId, {
        $inc: { leadsFound: created + updated },
        status: "COMPLETED",
      });
    } catch (error) {
      await logActivity("warn", "lead-ingestion", "Falha ao atualizar job", {
        jobId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { created, updated, errors };
}
