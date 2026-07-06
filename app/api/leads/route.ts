import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Lead from "@/models/Lead";
import { mapLeadToDTO } from "@/lib/lead-mapper";
import { leadCreateSchema } from "@/lib/validators";
import { normalizeCnpj } from "@/lib/utils";
import { parseRegion } from "@/lib/region";
import { calculateLeadScore } from "@/services/scoring.service";
import type { LeadSource } from "@/types/lead";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const minScore = searchParams.get("minScore");
    const search = searchParams.get("search");
    const region = searchParams.get("region");
    const jobId = searchParams.get("jobId");
    const page = Number(searchParams.get("page") ?? "1");
    const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100);

    const filter: Record<string, unknown> = {};

    if (status) filter.status = status;
    if (source) filter.sources = source;
    if (minScore) filter.score = { $gte: Number(minScore) };
    if (jobId) filter.prospectingJobs = jobId;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { cnpj: { $regex: search.replace(/\D/g, ""), $options: "i" } },
      ];
    }

    const parsedRegion = parseRegion(region ?? undefined);
    if (parsedRegion) {
      const regionClauses: Record<string, unknown>[] = [];

      if (parsedRegion.state) {
        regionClauses.push({
          "contacts.address": {
            $regex: `- ${parsedRegion.state}$|${parsedRegion.state}`,
            $options: "i",
          },
        });
      }

      if (parsedRegion.city && parsedRegion.requireCity !== false) {
        regionClauses.push({
          "contacts.address": {
            $regex: parsedRegion.city,
            $options: "i",
          },
        });
      }

      if (regionClauses.length > 0) {
        filter.$and = [...((filter.$and as unknown[]) ?? []), ...regionClauses];
      }
    }

    const skip = (page - 1) * limit;

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .sort({ score: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      Lead.countDocuments(filter),
    ]);

    return NextResponse.json({
      leads: leads.map(mapLeadToDTO),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = leadCreateSchema.parse(await request.json());
    await connectDB();

    const normalizedCnpj = normalizeCnpj(body.cnpj);
    const contacts = body.contacts ?? {};
    const sources: LeadSource[] = ["SCRAPER"];
    const metadata = {};

    const lead = await Lead.create({
      name: body.name,
      cnpj: normalizedCnpj,
      contacts,
      status: body.status ?? "NEW",
      sources,
      metadata,
      score: calculateLeadScore({
        sources,
        cnpj: normalizedCnpj,
        contacts,
        metadata,
      }),
      notes: body.notes
        ? [{ content: body.notes, createdAt: new Date() }]
        : [],
      lastActivityAt: new Date(),
    });

    return NextResponse.json(mapLeadToDTO(lead), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      { status: 400 },
    );
  }
}
