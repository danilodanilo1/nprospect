import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import ProspectingJob from "@/models/ProspectingJob";
import { prospectingSearchSchema } from "@/lib/validators";
import {
  getProspectingWarnings,
  runProspectingJob,
} from "@/services/prospecting-job.service";
import { logActivity } from "@/services/activity-log.service";

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

    void runProspectingJob(jobId, filters);

    return NextResponse.json({
      job: {
        _id: jobId,
        status: "RUNNING",
        filters,
        leadsFound: 0,
        warnings: getProspectingWarnings(sources),
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
