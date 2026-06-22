import ActivityLog from "@/models/ActivityLog";
import { connectDB } from "@/lib/db";
import type { ActivityLevel } from "@/models/ActivityLog";

export async function logActivity(
  level: ActivityLevel,
  source: string,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await connectDB();
    await ActivityLog.create({ level, source, message, metadata });
  } catch {
    console.error(`[ActivityLog] ${level} ${source}: ${message}`, metadata);
  }
}
