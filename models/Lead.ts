import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { LeadStatus, LeadSource, LeadMetadata, LeadContacts } from "@/types/lead";

export interface ILeadNote {
  _id?: mongoose.Types.ObjectId;
  content: string;
  createdAt: Date;
  createdBy?: mongoose.Types.ObjectId;
}

export interface ILead extends Document {
  name: string;
  cnpj?: string;
  contacts: LeadContacts;
  status: LeadStatus;
  score: number;
  sources: LeadSource[];
  placeId?: string;
  metadata: LeadMetadata;
  notes: ILeadNote[];
  assignedTo?: mongoose.Types.ObjectId;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LeadNoteSchema = new Schema<ILeadNote>(
  {
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: true },
);

const LeadSchema = new Schema<ILead>(
  {
    name: { type: String, required: true, trim: true },
    cnpj: { type: String, index: true, sparse: true },
    contacts: {
      phone: String,
      email: String,
      website: String,
      address: String,
    },
    status: {
      type: String,
      enum: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"],
      default: "NEW",
      index: true,
    },
    score: { type: Number, default: 0, index: true },
    sources: {
      type: [String],
      enum: ["GOOGLE_PLACES", "PNCP_BID", "SCRAPER"],
      default: [],
    },
    placeId: { type: String, index: true, sparse: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    notes: { type: [LeadNoteSchema], default: [] },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

LeadSchema.index({ name: "text", "contacts.address": "text" });

const Lead: Model<ILead> =
  mongoose.models.Lead ?? mongoose.model<ILead>("Lead", LeadSchema);

export default Lead;
