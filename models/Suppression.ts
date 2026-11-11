import mongoose, { Schema, type Model } from "mongoose";

/** Lista de bloqueio permanente: e-mail ou domínio que nunca mais recebe nada. */
export interface ISuppression {
  value: string; // e-mail ou @dominio.com
  reason: string;
  createdAt: Date;
}

const SuppressionSchema = new Schema<ISuppression>(
  {
    value: { type: String, required: true, unique: true, lowercase: true, trim: true },
    reason: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "suppressions" },
);

const Suppression: Model<ISuppression> =
  mongoose.models.Suppression ?? mongoose.model<ISuppression>("Suppression", SuppressionSchema);

export async function isSuppressed(email: string | undefined): Promise<boolean> {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  const domain = `@${e.split("@")[1] ?? ""}`;
  return Boolean(await Suppression.exists({ value: { $in: [e, domain] } }));
}

export default Suppression;
