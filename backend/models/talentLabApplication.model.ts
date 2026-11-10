import { Schema, model } from "mongoose";

export const APPLICATION_STATUSES = [
  "new",
  "reviewing",
  "shortlisted",
  "declined",
  "accepted",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/**
 * An application to a Talent Lab program, from the public site's
 * /talent-lab/apply form. Field names match that form's `applySchema`
 * (iffa-2026 `talent-lab/ui/views/apply-page.tsx`) one for one.
 *
 * accessRequirements, firstNationsIdentification and regionalRemote are
 * sensitive: they are returned only by the staff "get one" route, never by the
 * list route and never in an email.
 */
export interface ITalentLabApplication {
  reference: string;
  status: ApplicationStatus;
  staffNotes?: string;

  program: string;
  fullName: string;
  email: string;
  phone: string;
  location: string;

  primaryDiscipline: string;
  secondaryDiscipline?: string;
  careerStage: string;
  biography: string;
  careerObjective: string;

  projectDescription: string;
  whyThisProgram: string;
  portfolioLink: string;
  availability: string;
  previousPrograms?: string;

  accessRequirements?: string;
  firstNationsIdentification?: string;
  regionalRemote?: string;

  consents: { terms: boolean; conduct: boolean; privacy: boolean; media: boolean };
  createdAt?: Date;
  updatedAt?: Date;
}

const applicationSchema = new Schema<ITalentLabApplication>(
  {
    reference: { type: String, required: true, unique: true },
    status: { type: String, enum: APPLICATION_STATUSES, default: "new" },
    staffNotes: { type: String, default: "" },

    program: { type: String, required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    location: { type: String, required: true },

    primaryDiscipline: { type: String, required: true },
    secondaryDiscipline: { type: String, default: "" },
    careerStage: { type: String, required: true },
    biography: { type: String, required: true },
    careerObjective: { type: String, required: true },

    projectDescription: { type: String, required: true },
    whyThisProgram: { type: String, required: true },
    portfolioLink: { type: String, required: true },
    availability: { type: String, required: true },
    previousPrograms: { type: String, default: "" },

    accessRequirements: { type: String, default: "" },
    firstNationsIdentification: { type: String, default: "" },
    regionalRemote: { type: String, default: "" },

    consents: {
      terms: { type: Boolean, required: true },
      conduct: { type: Boolean, required: true },
      privacy: { type: Boolean, required: true },
      media: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

applicationSchema.index({ createdAt: -1 });
applicationSchema.index({ status: 1, createdAt: -1 });

export default model<ITalentLabApplication>("TalentLabApplication", applicationSchema);
