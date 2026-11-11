import type { AnyStage, ProspectSignal, Stage, StageMode } from "@/lib/funnel";

export interface SystemDTO {
  running: boolean;
  pausedReason: string | null;
  changedAt: string;
  changedBy: string | null;
  stageModes: Record<Stage, StageMode>;
  workerOnline: boolean;
  workerHeartbeatAt: string | null;
  counts: Partial<Record<AnyStage, number>>;
  pendingApprovals: number;
  sentLast24h: number;
}

export interface ProspectDTO {
  _id: string;
  company: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  city?: string;
  score: number;
  stage: AnyStage;
  owner: "IA" | "HUMANO";
  paused: boolean;
  signals: ProspectSignal[];
  touches: number;
  lastTouchAt?: string;
  nextActionAt?: string;
  source: string;
  updatedAt: string;
}

export interface InteractionDTO {
  _id: string;
  prospect: string | Pick<ProspectDTO, "_id" | "company" | "contactName" | "email" | "stage" | "owner" | "score">;
  channel: string;
  direction: "OUT" | "IN" | "INTERNAL";
  author: "IA" | "HUMANO" | "LEAD" | "SISTEMA";
  status: string;
  kind: string;
  subject?: string;
  body: string;
  reason?: string;
  prompt?: string;
  aiModel?: string;
  replyClass?: string;
  error?: string;
  sentAt?: string;
  createdAt: string;
}
