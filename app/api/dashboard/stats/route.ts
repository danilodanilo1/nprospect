import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Lead from "@/models/Lead";
import ProspectingJob from "@/models/ProspectingJob";

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const [
      totalLeads,
      newLeads,
      avgScoreResult,
      statusCounts,
      recentJobs,
    ] = await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ status: "NEW" }),
      Lead.aggregate<{ avg: number }>([
        { $group: { _id: null, avg: { $avg: "$score" } } },
      ]),
      Lead.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      ProspectingJob.find().sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    return NextResponse.json({
      kpis: {
        totalLeads,
        newLeads,
        avgScore: Math.round(avgScoreResult[0]?.avg ?? 0),
        jobsCompleted: recentJobs.filter((j) => j.status === "COMPLETED").length,
      },
      pipeline: statusCounts.map((item) => ({
        status: item._id,
        count: item.count,
      })),
      recentJobs: recentJobs.map((job) => ({
        _id: job._id.toString(),
        status: job.status,
        leadsFound: job.leadsFound,
        createdAt: job.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      { status: 500 },
    );
  }
}
