import mongoose, { Schema, type Model } from "mongoose";
import { DEFAULT_STAGE_MODES, type Stage, type StageMode } from "@/lib/funnel";

export interface ISystemState {
  _id: string;
  running: boolean;
  stageModes: Record<Stage, StageMode>;
  pausedReason?: string;
  changedAt: Date;
  changedBy?: string;
  workerHeartbeatAt?: Date;
  imapLastUid?: number;
  collectorRuns?: Record<string, Date>;
}

const SystemStateSchema = new Schema<ISystemState>(
  {
    _id: { type: String, default: "system" },
    running: { type: Boolean, default: false },
    stageModes: { type: Schema.Types.Mixed, default: () => ({ ...DEFAULT_STAGE_MODES }) },
    pausedReason: String,
    changedAt: { type: Date, default: Date.now },
    changedBy: String,
    workerHeartbeatAt: Date,
    imapLastUid: Number,
    collectorRuns: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { collection: "system_state", versionKey: false },
);

const SystemState: Model<ISystemState> =
  mongoose.models.SystemState ?? mongoose.model<ISystemState>("SystemState", SystemStateSchema);

export async function getSystemState(): Promise<ISystemState> {
  const doc = await SystemState.findOneAndUpdate(
    { _id: "system" },
    { $setOnInsert: { running: false, stageModes: { ...DEFAULT_STAGE_MODES }, changedAt: new Date() } },
    { upsert: true, returnDocument: "after", lean: true },
  );
  if (!doc) throw new Error("system_state não encontrado");
  return {
    ...doc,
    stageModes: { ...DEFAULT_STAGE_MODES, ...(doc.stageModes ?? {}) },
  } as ISystemState;
}

export default SystemState;
