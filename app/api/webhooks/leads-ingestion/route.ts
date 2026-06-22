import { NextResponse } from "next/server";
import { leadsIngestionSchema } from "@/lib/validators";
import {
  validateWebhookSecret,
  unauthorizedWebhookResponse,
} from "@/lib/webhook";
import { ingestLeadsBatch } from "@/services/lead-ingestion.service";
import { logActivity } from "@/services/activity-log.service";

export async function POST(request: Request) {
  if (!validateWebhookSecret(request)) {
    return unauthorizedWebhookResponse();
  }

  try {
    const body = leadsIngestionSchema.parse(await request.json());
    const result = await ingestLeadsBatch(body.leads, body.jobId);

    await logActivity("info", "leads-ingestion", "Batch ingerido com sucesso", {
      ...result,
      jobId: body.jobId,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    await logActivity("error", "leads-ingestion", "Falha no webhook", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erro" },
      { status: 200 },
    );
  }
}
