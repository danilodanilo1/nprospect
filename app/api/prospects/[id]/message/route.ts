import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import Prospect from "@/models/Prospect";
import Interaction from "@/models/Interaction";
import { takeover } from "@/services/prospect.service";

interface Ctx {
  params: Promise<{ id: string }>;
}

const schema = z.object({ subject: z.string().optional(), body: z.string().min(1) });

/** Humano escreve direto para o lead. O envio passa pelo Guarda e assume o lead. */
export const POST = withAuth(async (req, { params }: Ctx, user) => {
  const { id } = await params;
  const { subject, body } = schema.parse(await req.json());
  const p = await Prospect.findById(id);
  if (!p) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  if (p.owner !== "HUMANO") await takeover(id, user);
  const lastIn = await Interaction.findOne({ prospect: id, direction: "IN" }).sort({ createdAt: -1 });
  const msg = await Interaction.create({
    prospect: p._id,
    channel: "EMAIL",
    direction: "OUT",
    author: "HUMANO",
    status: "AGENDADA",
    kind: p.touches === 0 ? "primeiro-contato" : "manual",
    subject: subject || (p.threadSubject ? `Re: ${p.threadSubject.replace(/^re:\s*/i, "")}` : "nRecruit"),
    body,
    inReplyTo: lastIn?.messageId ?? p.threadMessageId,
    firstTouch: p.touches === 0,
    approvedBy: user,
    scheduledFor: new Date(),
  });
  return NextResponse.json(msg);
});
