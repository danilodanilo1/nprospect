import mongoose, { Schema, type Document, type Model } from "mongoose";

export type ActivityLevel = "info" | "warn" | "error";

export interface IActivityLog extends Document {
  level: ActivityLevel;
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    level: {
      type: String,
      enum: ["info", "warn", "error"],
      default: "info",
    },
    source: { type: String, required: true, index: true },
    message: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const ActivityLog: Model<IActivityLog> =
  mongoose.models.ActivityLog ??
  mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema);

export default ActivityLog;
