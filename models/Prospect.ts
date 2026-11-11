import mongoose, { Schema, type Document, type Model } from "mongoose";
import { ALL_STAGES, SIGNALS, type AnyStage, type ProspectSignal } from "@/lib/funnel";

export type ProspectOwner = "IA" | "HUMANO";

export interface IProspect extends Document {
  company: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  instagram?: string;
  linkedin?: string;
  city?: string;
  cnpj?: string;
  teamSize?: number;
  isRecruitmentCompany: boolean;
  signals: ProspectSignal[];
  score: number;
  stage: AnyStage;
  owner: ProspectOwner;
  paused: boolean;
  source: string;
  batch?: string;
  /** e-mail: id da 1ª mensagem, para os follow-ups caírem na mesma conversa */
  threadMessageId?: string;
  threadSubject?: string;
  touches: number;
  lastTouchAt?: Date;
  nextActionAt?: Date;
  lastInboundAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SignalSchema = new Schema<ProspectSignal>(
  {
    type: { type: String, enum: SIGNALS, required: true },
    seenAt: { type: Date, required: true },
    evidenceUrl: String,
    evidenceText: String,
  },
  { _id: false },
);

const ProspectSchema = new Schema<IProspect>(
  {
    company: { type: String, required: true, trim: true },
    contactName: String,
    email: { type: String, lowercase: true, trim: true },
    phone: String,
    website: String,
    instagram: String,
    linkedin: String,
    city: String,
    cnpj: String,
    teamSize: Number,
    isRecruitmentCompany: { type: Boolean, default: true },
    signals: { type: [SignalSchema], default: [] },
    score: { type: Number, default: 0, index: true },
    stage: { type: String, enum: ALL_STAGES, default: "DESCOBERTO", index: true },
    owner: { type: String, enum: ["IA", "HUMANO"], default: "IA", index: true },
    paused: { type: Boolean, default: false },
    source: { type: String, default: "manual" },
    batch: String,
    threadMessageId: String,
    threadSubject: String,
    touches: { type: Number, default: 0 },
    lastTouchAt: Date,
    nextActionAt: { type: Date, index: true },
    lastInboundAt: Date,
    notes: String,
  },
  { timestamps: true, collection: "prospects" },
);

ProspectSchema.index({ email: 1 }, { unique: true, sparse: true });

const Prospect: Model<IProspect> =
  mongoose.models.Prospect ?? mongoose.model<IProspect>("Prospect", ProspectSchema);

export default Prospect;
