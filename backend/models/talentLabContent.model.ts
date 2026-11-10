import { Schema, model } from "mongoose";

/**
 * Staff-editable Talent Lab content: Events, Opportunities, Mentors.
 *
 * Field names and vocabularies match iffa-2026's `talent-lab/lib/types.ts`
 * exactly, because the public routes return these records in that shape and the
 * site's views consume them unchanged. Add a value to an enum here and there
 * together. Dates stay display strings ("Thu 20 Aug 2026 · 6:00pm", "Rolling"),
 * as the site's types require.
 *
 * Every record also has `order` (position on the page) and `isPublished`
 * (staff can pull an item off the site without deleting it).
 */

export const DISCIPLINES = ["Directing", "Producing", "Writing", "Acting", "Documentary", "Crew"] as const;
export const CAREER_STAGES = ["Emerging", "Early career"] as const;
export const DELIVERY_MODES = ["Online", "Hybrid", "In person"] as const;
export const OPPORTUNITY_STATUSES = [
  "eoi",
  "opening-soon",
  "open",
  "closing-soon",
  "closed",
  "in-progress",
  "completed",
] as const;
export const EVENT_STATES = ["upcoming", "past"] as const;
export const MENTOR_TYPES = ["Confirmed Mentor", "Past Guest", "Partner"] as const;

const str = (required = true) => ({ type: String, required, trim: true, default: required ? undefined : "" });
const placement = {
  order: { type: Number, default: 0 },
  isPublished: { type: Boolean, default: true },
};

export interface ITalentLabEvent {
  slug: string;
  title: string;
  when: string;
  format: string;
  speakerName: string;
  speakerRole: string;
  mode: string;
  state: (typeof EVENT_STATES)[number];
  description: string;
  registerHref?: string | null;
  order: number;
  isPublished: boolean;
}

const eventSchema = new Schema<ITalentLabEvent>(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    title: str(),
    when: str(),
    format: str(),
    speakerName: str(),
    speakerRole: str(),
    mode: str(),
    state: { type: String, enum: EVENT_STATES, required: true },
    description: str(),
    registerHref: { type: String, default: null },
    ...placement,
  },
  { timestamps: true },
);

export interface ITalentLabOpportunity {
  /** The site's `Opportunity.id`. Stored under another name: Mongoose reserves `id`. */
  opportunityId: string;
  streamSlug: string;
  title: string;
  summary: string;
  status: (typeof OPPORTUNITY_STATUSES)[number];
  tags: string[];
  discipline: (typeof DISCIPLINES)[number];
  stage: (typeof CAREER_STAGES)[number];
  deliveryMode: (typeof DELIVERY_MODES)[number];
  modeLabel: string;
  opensOn: string;
  closesOn: string;
  programDates: string;
  cycle: string;
  ctaLabel: string;
  order: number;
  isPublished: boolean;
}

const opportunitySchema = new Schema<ITalentLabOpportunity>(
  {
    opportunityId: { type: String, required: true, unique: true, trim: true },
    streamSlug: str(),
    title: str(),
    summary: str(),
    status: { type: String, enum: OPPORTUNITY_STATUSES, required: true },
    tags: { type: [String], default: [] },
    discipline: { type: String, enum: DISCIPLINES, required: true },
    stage: { type: String, enum: CAREER_STAGES, required: true },
    deliveryMode: { type: String, enum: DELIVERY_MODES, required: true },
    modeLabel: str(),
    opensOn: str(),
    closesOn: str(),
    programDates: str(),
    cycle: str(),
    ctaLabel: str(),
    ...placement,
  },
  { timestamps: true },
);

export interface ITalentLabMentor {
  slug: string;
  name: string;
  role: string;
  organisation: string;
  country: string;
  type: (typeof MENTOR_TYPES)[number];
  discipline: (typeof DISCIPLINES)[number];
  year: string;
  bio: string;
  order: number;
  isPublished: boolean;
}

const mentorSchema = new Schema<ITalentLabMentor>(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    name: str(),
    role: str(),
    organisation: str(),
    country: str(),
    type: { type: String, enum: MENTOR_TYPES, required: true },
    discipline: { type: String, enum: DISCIPLINES, required: true },
    year: str(),
    bio: str(),
    ...placement,
  },
  { timestamps: true },
);

export const TalentLabEvent = model<ITalentLabEvent>("TalentLabEvent", eventSchema);
export const TalentLabOpportunity = model<ITalentLabOpportunity>("TalentLabOpportunity", opportunitySchema);
export const TalentLabMentor = model<ITalentLabMentor>("TalentLabMentor", mentorSchema);
