import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import Interaction from "@/models/Interaction";
import { logEvent } from "@/services/prospect.service";

interface Ctx {
  params: Promise<{ id: string }>;
}

const schema = z.object({
  action: z.enum(["approve", "reject"]),
  subject: z.string().optional(),
  body: z.string().optional(),
});

/** Aprovar (com ou sem edição) ou rejeitar um rascunho da IA. */
export const POST = withAuth(async (req, { params }: Ctx, user) => {
  const { id } = await params;
  const { action, subject, body } = schema.parse(await req.json());
  const msg = await Interaction.findById(id);
  if (!msg) return NextResponse.json({ error: "Mensagem não encontrada" }, { status: 404 });
  if (msg.status !== "PENDENTE") return NextResponse.json({ error: `Mensagem já está ${msg.status}` }, { status: 409 });

  if (action === "reject") {
    msg.status = "REJEITADA";
    msg.approvedBy = user;
    await msg.save();
    await logEvent(msg.prospect, "rejeitado", `${user} rejeitou o rascunho (${msg.kind}).`, "HUMANO");
    return NextResponse.json(msg);
  }

  const edited = (body !== undefined && body !== msg.body) || (subject !== undefined && subject !== msg.subject);
  if (subject !== undefined) msg.subject = subject;
  if (body !== undefined) msg.body = body;
  msg.status = "AGENDADA";
  msg.approvedBy = user;
  msg.scheduledFor = new Date();
  await msg.save();
  await logEvent(msg.prospect, "aprovado", `${user} aprovou ${edited ? "com edição " : ""}o rascunho (${msg.kind}).`, "HUMANO");
  return NextResponse.json(msg);
});
