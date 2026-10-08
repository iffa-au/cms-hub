import { Schema, model, Types } from "mongoose";

/**
 * Who a category is awarded to, which decides whose names the public form
 * offers as nominees. "craft" covers cinematography, editing and writing:
 * those credits sit in the free-text "Other" crew group, and a director or
 * producer often holds them too, so all three groups are eligible.
 */
export const NOMINEE_TYPES = [
  "actors",
  "directors",
  "craft",
  "producers",
  "whole-team",
] as const;
export type NomineeType = (typeof NOMINEE_TYPES)[number];

export interface IAwardCategory {
  name: string;
  description?: string;
  // The fields below drive the public submission form. Categories from past
  // years keep the defaults and so never appear on it.
  openForSubmission?: boolean;
  group?: string;
  nomineeType?: NomineeType;
  // Empty means every screen format may enter.
  contentTypeIds?: Types.ObjectId[];
  sortOrder?: number;
}

const awardCategorySchema = new Schema<IAwardCategory>({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    trim: true,
  },
  openForSubmission: {
    type: Boolean,
    default: false,
  },
  group: {
    type: String,
    default: "",
    trim: true,
  },
  nomineeType: {
    type: String,
    enum: NOMINEE_TYPES,
    default: "whole-team",
  },
  contentTypeIds: {
    type: [{ type: Schema.Types.ObjectId, ref: "ContentType" }],
    default: [],
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
});

const AwardCategory = model("AwardCategory", awardCategorySchema);
export default AwardCategory;
