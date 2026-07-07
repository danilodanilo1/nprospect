import ProspectingJob from "@/models/ProspectingJob";
import { connectDB } from "@/lib/db";
import type { ProspectingFilters } from "@/types/prospecting";
import { searchGooglePlaces } from "@/services/google-places.service";
import { searchPncpAllPages } from "@/services/pncp.service";
import { ingestLeadsBatch } from "@/services/lead-ingestion.service";
import { logActivity } from "@/services/activity-log.service";

async function triggerN8nWebhook(
  jobId: string,
  filters: ProspectingFilters,
): Promise<void> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.N8N_WEBHOOK_SECRET
          ? { "X-Webhook-Secret": process.env.N8N_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify({
        jobId,
        filters,
        callbackUrl: `${process.env.NEXTAUTH_URL}/api/webhooks/leads-ingestion`,
      }),
    });
  } catch (error) {
    await logActivity("warn", "prospecting", "Falha ao disparar n8n", {
      jobId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export function getProspectingWarnings(
  sources: NonNullable<ProspectingFilters["sources"]>,
): string[] {
  const warnings: string[] = [];

  if (sources.includes("GOOGLE_PLACES") && !process.env.GOOGLE_PLACES_API_KEY) {
    warnings.push(
      "GOOGLE_PLACES_API_KEY não configurada. Configure no .env.local para buscar empresas.",
    );
  }

  return warnings;
}

export async function runProspectingJob(
  jobId: string,
  filters: ProspectingFilters,
): Promise<void> {
  await connectDB();

  const sources = filters.sources ?? ["GOOGLE_PLACES", "PNCP_BID"];
  const collectedLeads = [];

  try {
    if (sources.includes("GOOGLE_PLACES") && process.env.GOOGLE_PLACES_API_KEY) {
      const googleLeads = await searchGooglePlaces({
        query: (filters.keywords ?? ["construtora"]).join(" "),
        region: filters.region ?? process.env.DEFAULT_SEARCH_REGION,
        radiusKm: filters.radiusKm,
      });
      collectedLeads.push(...googleLeads);
    }

    if (sources.includes("PNCP_BID")) {
      const pncpLeads = await searchPncpAllPages({
        keywords: filters.keywords,
        object: filters.pncpObject,
        region: filters.region ?? process.env.DEFAULT_SEARCH_REGION,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        minValue: filters.minValue,
      });
      collectedLeads.push(...pncpLeads);
    }

    const ingestion = await ingestLeadsBatch(collectedLeads, jobId);

    await ProspectingJob.findByIdAndUpdate(jobId, {
      status: "COMPLETED",
      leadsFound: ingestion.created + ingestion.updated,
    });

    void triggerN8nWebhook(jobId, filters);
  } catch (error) {
    await ProspectingJob.findByIdAndUpdate(jobId, {
      status: "FAILED",
      leadsFound: 0,
    });

    await logActivity("error", "prospecting", "Falha ao executar job", {
      jobId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
