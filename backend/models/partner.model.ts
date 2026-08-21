import { Schema, model } from "mongoose";

export const PARTNER_TIERS = ["PRESENTING", "CULTURAL", "SUPPORTING"] as const;
export type PartnerTier = (typeof PARTNER_TIERS)[number];

export interface IPartner {
  name: string;
  logoUrl: string;
  websiteUrl?: string;
  tier: PartnerTier;
  // Sort position within a tier. Ties fall back to name so the public page
  // never renders partners in an arbitrary, shifting order.
  order?: number;
  // Lets staff pull a partner off the public page without losing the record
  // (and its logo) — e.g. a sponsor who lapses but may return next year.
  isActive?: boolean;
}

const partnerSchema = new Schema<IPartner>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxLength: 200,
    },
    logoUrl: {
      type: String,
      required: true,
      trim: true,
    },
    websiteUrl: {
      type: String,
      default: "",
      trim: true,
    },
    tier: {
      type: String,
      enum: PARTNER_TIERS,
      required: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const Partner = model("Partner", partnerSchema);
export default Partner;
