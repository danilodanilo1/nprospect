import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import ProspectingJob from "@/models/ProspectingJob";
import { prospectingSearchSchema } from "@/lib/validators";
import { searchGooglePlaces } from "@/services/google-places.service";
import { searchPncpAllPages } from "@/services/pncp.service";
import { ingestLeadsBatch } from "@/services/lead-ingestion.service";
import { logActivity } from "@/services/activity-log.service";

async function triggerN8nWebhook(
  jobId: string,
  filters: ReturnType<typeof prospectingSearchSchema.parse>,
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

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const filters = prospectingSearchSchema.parse(await request.json());
    await connectDB();

    const job = await ProspectingJob.create({
      status: "RUNNING",
      filters,
      createdBy: session.user.id,
    });

    const jobId = job._id.toString();
    const sources = filters.sources ?? ["GOOGLE_PLACES", "PNCP_BID"];
    const collectedLeads = [];

    if (sources.includes("GOOGLE_PLACES")) {
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

    const updatedJob = await ProspectingJob.findById(jobId).lean();

    return NextResponse.json({
      job: {
        _id: jobId,
        status: updatedJob?.status ?? "COMPLETED",
        filters,
        leadsFound: updatedJob?.leadsFound ?? 0,
        ingestion,
      },
    });
  } catch (error) {
    await logActivity("error", "prospecting", "Falha na busca", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      { status: 400 },
    );
  }
}
