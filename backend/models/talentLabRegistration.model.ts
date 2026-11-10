import { Schema, model } from "mongoose";

/**
 * Registration of interest in the Talent Lab, from the public site's
 * /talent-lab/register form. Field names match that form's `registerSchema`
 * (iffa-2026 `talent-lab/ui/views/register-page.tsx`).
 *
 * accessRequirements is sensitive: staff "get one" route only.
 */
export interface ITalentLabRegistration {
  fullName: string;
  email: string;
  state: string;
  discipline: string;
  careerStage: string;
  portfolioLink?: string;
  programs: string[];
  accessRequirements?: string;
  mailingList: boolean;
  privacyConsent: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const registrationSchema = new Schema<ITalentLabRegistration>(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    state: { type: String, required: true },
    discipline: { type: String, required: true },
    careerStage: { type: String, required: true },
    portfolioLink: { type: String, default: "" },
    programs: { type: [String], default: [] },
    accessRequirements: { type: String, default: "" },
    mailingList: { type: Boolean, default: false },
    privacyConsent: { type: Boolean, required: true },
  },
  { timestamps: true },
);

registrationSchema.index({ createdAt: -1 });

export default model<ITalentLabRegistration>("TalentLabRegistration", registrationSchema);
