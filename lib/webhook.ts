import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { logActivity } from "@/services/activity-log.service";

export function validateWebhookSecret(request: Request): boolean {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret) return false;

  const headerSecret = request.headers.get("x-webhook-secret");
  if (!headerSecret) return false;

  try {
    const a = Buffer.from(secret);
    const b = Buffer.from(headerSecret);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function unauthorizedWebhookResponse(): Promise<NextResponse> {
  await logActivity("warn", "webhook", "Tentativa de webhook não autorizada");
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
