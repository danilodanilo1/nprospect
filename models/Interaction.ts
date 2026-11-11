import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { AnyStage } from "@/lib/funnel";

export type Channel = "EMAIL" | "WHATSAPP" | "LINKEDIN" | "INSTAGRAM" | "TELEFONE" | "SISTEMA";
export type Direction = "OUT" | "IN" | "INTERNAL";
export type Author = "IA" | "HUMANO" | "LEAD" | "SISTEMA";
/** PENDENTE = esperando aprovação humana; AGENDADA = aprovada, esperando o Guarda liberar */
export type InteractionStatus =
  | "PENDENTE"
  | "AGENDADA"
  | "ENVIADA"
  | "RECEBIDA"
  | "REJEITADA"
  | "BLOQUEADA"
  | "ERRO"
  | "REGISTRO";

export type ReplyClass = "INTERESSE" | "DUVIDA" | "OBJECAO" | "NAO_AGORA" | "REMOVER" | "AMBIGUA" | "BOUNCE";

export interface IInteraction extends Document {
  prospect: mongoose.Types.ObjectId;
  channel: Channel;
  direction: Direction;
  author: Author;
  status: InteractionStatus;
  kind: string; // primeiro-contato, follow-up-1, resposta, mudanca-estagio, assumir...
  subject?: string;
  body: string;
  reason?: string; // por que a IA fez isso
  prompt?: string;
  aiModel?: string;
  tokens?: number;
  replyClass?: ReplyClass;
  stageBefore?: AnyStage;
  stageAfter?: AnyStage;
  messageId?: string;
  inReplyTo?: string;
  firstTouch: boolean;
  scheduledFor?: Date;
  sentAt?: Date;
  approvedBy?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InteractionSchema = new Schema<IInteraction>(
  {
    prospect: { type: Schema.Types.ObjectId, ref: "Prospect", required: true, index: true },
    channel: { type: String, required: true },
    direction: { type: String, required: true },
    author: { type: String, required: true },
    status: { type: String, required: true, index: true },
    kind: { type: String, required: true },
    subject: String,
    body: { type: String, default: "" },
    reason: String,
    prompt: String,
    aiModel: String,
    tokens: Number,
    replyClass: String,
    stageBefore: String,
    stageAfter: String,
    messageId: { type: String, index: true, sparse: true },
    inReplyTo: String,
    firstTouch: { type: Boolean, default: false },
    scheduledFor: Date,
    sentAt: Date,
    approvedBy: String,
    error: String,
  },
  { timestamps: true, collection: "interactions" },
);

InteractionSchema.index({ createdAt: -1 });
InteractionSchema.index({ status: 1, scheduledFor: 1 });

const Interaction: Model<IInteraction> =
  mongoose.models.Interaction ?? mongoose.model<IInteraction>("Interaction", InteractionSchema);

export default Interaction;
