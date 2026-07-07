import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { CnpjDataMetadata } from "@/types/lead";

export interface ICnpjCache extends Document {
  cnpj: string;
  data: CnpjDataMetadata;
  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CnpjCacheSchema = new Schema<ICnpjCache>(
  {
    cnpj: { type: String, required: true, unique: true, index: true },
    data: { type: Schema.Types.Mixed, required: true },
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const CnpjCache: Model<ICnpjCache> =
  mongoose.models.CnpjCache ??
  mongoose.model<ICnpjCache>("CnpjCache", CnpjCacheSchema);

export default CnpjCache;
