import { NextResponse } from "next/server";
import { scraperResultSchema } from "@/lib/validators";
import {
  validateWebhookSecret,
  unauthorizedWebhookResponse,
} from "@/lib/webhook";
import { upsertLeadFromIngestion } from "@/services/lead-ingestion.service";
import { logActivity } from "@/services/activity-log.service";
import type { IngestionLeadPayload } from "@/types/ingestion";

export async function POST(request: Request) {
  if (!validateWebhookSecret(request)) {
    return unauthorizedWebhookResponse();
  }

  try {
    const body = scraperResultSchema.parse(await request.json());

    let payload: IngestionLeadPayload;

    if (body.lead) {
      payload = {
        ...body.lead,
        source: "SCRAPER",
        metadata: {
          ...body.lead.metadata,
          scraper: {
            url: body.url,
            ...body.data,
          },
        },
      };
    } else {
      const name =
        typeof body.data.name === "string"
          ? body.data.name
          : typeof body.data.company === "string"
            ? body.data.company
            : "Empresa não identificada";

      payload = {
        name,
        source: "SCRAPER",
        cnpj: typeof body.data.cnpj === "string" ? body.data.cnpj : undefined,
        contacts: {
          phone:
            typeof body.data.phone === "string" ? body.data.phone : undefined,
          email:
            typeof body.data.email === "string" ? body.data.email : undefined,
          website:
            typeof body.data.website === "string"
              ? body.data.website
              : body.url,
          address:
            typeof body.data.address === "string"
              ? body.data.address
              : undefined,
        },
        metadata: {
          scraper: {
            url: body.url,
            ...body.data,
          },
        },
      };
    }

    const result = await upsertLeadFromIngestion(payload);

    await logActivity("info", "scraper-results", "Resultado de scraper processado", {
      jobId: body.jobId,
      leadId: result.lead._id.toString(),
      created: result.created,
    });

    return NextResponse.json({
      success: true,
      leadId: result.lead._id.toString(),
      created: result.created,
    });
  } catch (error) {
    await logActivity("error", "scraper-results", "Falha no webhook scraper", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erro" },
      { status: 200 },
    );
  }
}
