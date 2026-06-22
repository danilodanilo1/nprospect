import mongoose, { Schema, type Document, type Model } from "mongoose";
import type {
  ProspectingFilters,
  ProspectingJobStatus,
} from "@/types/prospecting";

export interface IProspectingJob extends Document {
  status: ProspectingJobStatus;
  filters: ProspectingFilters;
  leadsFound: number;
  error?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProspectingJobSchema = new Schema<IProspectingJob>(
  {
    status: {
      type: String,
      enum: ["PENDING", "RUNNING", "COMPLETED", "FAILED"],
      default: "PENDING",
      index: true,
    },
    filters: {
      region: String,
      radiusKm: Number,
      keywords: [String],
      pncpObject: String,
      sources: [String],
    },
    leadsFound: { type: Number, default: 0 },
    error: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

const ProspectingJob: Model<IProspectingJob> =
  mongoose.models.ProspectingJob ??
  mongoose.model<IProspectingJob>("ProspectingJob", ProspectingJobSchema);

export default ProspectingJob;
