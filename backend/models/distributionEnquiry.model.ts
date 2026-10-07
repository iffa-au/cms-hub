import { Schema, model, Types } from "mongoose";

/**
 * A filmmaker or rights holder asking IFFA to help distribute their film,
 * submitted from the public site's /distribution-enquiry form.
 *
 * The fixed vocabularies (role, production status, rights, territories,
 * deliverables) are stored as slugs. The allowed values live in the controller
 * and must match iffa-2026's `distribution-enquiry/data/form-options.ts`; the
 * admin client maps them back to labels.
 */
export interface IDistributionEnquiry {
  // About the submitter
  name: string;
  email: string;
  phone?: string;
  company: string;
  role: string;
  website?: string;

  // The film
  title: string;
  contentType: Types.ObjectId;
  genreIds: Types.ObjectId[];
  country: Types.ObjectId;
  language: Types.ObjectId;
  runtimeMinutes: number;
  year: number;
  productionStatus: string;
  synopsis: string;
  festivals?: string;

  // Distribution
  rights: string[];
  territories: string[];
  territoriesSold?: string;
  deliverables?: string[];

  // Screening material
  screenerUrl: string;
  screenerPassword?: string;
  trailerUrl?: string;
  notes?: string;

  rightsConfirmed: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const distributionEnquirySchema = new Schema<IDistributionEnquiry>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: "" },
    company: { type: String, required: true },
    role: { type: String, required: true },
    website: { type: String, default: "" },

    title: { type: String, required: true },
    contentType: { type: Types.ObjectId, ref: "ContentType", required: true },
    genreIds: [{ type: Types.ObjectId, ref: "Genre" }],
    country: { type: Types.ObjectId, ref: "Country", required: true },
    language: { type: Types.ObjectId, ref: "Language", required: true },
    runtimeMinutes: { type: Number, required: true },
    year: { type: Number, required: true },
    productionStatus: { type: String, required: true },
    synopsis: { type: String, required: true },
    festivals: { type: String, default: "" },

    rights: { type: [String], default: [] },
    territories: { type: [String], default: [] },
    territoriesSold: { type: String, default: "" },
    deliverables: { type: [String], default: [] },

    screenerUrl: { type: String, required: true },
    // Kept so staff can open the screener; the submitter shares it for that.
    screenerPassword: { type: String, default: "" },
    trailerUrl: { type: String, default: "" },
    notes: { type: String, default: "" },

    rightsConfirmed: { type: Boolean, required: true },
  },
  { timestamps: true },
);

const DistributionEnquiry = model("DistributionEnquiry", distributionEnquirySchema);
export default DistributionEnquiry;
