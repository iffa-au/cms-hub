import { Schema, model } from "mongoose";

/**
 * Staff-editable Talent Lab content: Events, Opportunities, Mentors, Programs.
 *
 * Field names and vocabularies match iffa-2026's `talent-lab/lib/types.ts`
 * exactly, because the public routes return these records in that shape and the
 * site's views consume them unchanged. Add a value to an enum here and there
 * together. Dates stay display strings ("Thu 20 Aug 2026 · 6:00pm", "Rolling"),
 * as the site's types require.
 *
 * Every record also has `order` (position on the page) and `isPublished`
 * (staff can pull an item off the site without deleting it). Programs also
 * have `isArchived`: a past program kept for the record, off the website and
 * listed separately in the CMS. Hidden = draft / not ready; archived = finished.
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
/**
 * Whether an opportunity takes applications. "auto" (the default) lets the
 * site close it once `closesOn` has passed; "open" / "closed" are staff
 * overriding that by hand.
 */
export const APPLICATION_OVERRIDES = ["auto", "open", "closed"] as const;
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
  applicationsOverride: (typeof APPLICATION_OVERRIDES)[number];
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
    applicationsOverride: { type: String, enum: APPLICATION_OVERRIDES, default: "auto" },
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

export interface ITalentLabProgram {
  /** The site's `Stream.slug`: /talent-lab/programs/<slug>, and Opportunity.streamSlug. */
  slug: string;
  /** "01" — the mono badge on the card. */
  code: string;
  name: string;
  description: string;
  about: string[];
  facts: { label: string; value: string }[];
  curriculum: { week: string; title: string; body: string }[];
  places: string;
  assessmentNote: string;
  deliveryMode: (typeof DELIVERY_MODES)[number];
  location: string;
  /** Fallback only: the site shows the linked opportunity's status where there is one. */
  status: (typeof OPPORTUNITY_STATUSES)[number];
  mentorSlugs: string[];
  resourceIds: string[];
  order: number;
  isPublished: boolean;
  /** A past program kept for the record: off the website, in the CMS's Archived tab. */
  isArchived: boolean;
  archivedAt: Date | null;
}

const factSchema = new Schema({ label: str(), value: str() }, { _id: false });
const weekSchema = new Schema({ week: str(), title: str(), body: str() }, { _id: false });

const programSchema = new Schema<ITalentLabProgram>(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    code: str(),
    name: str(),
    description: str(),
    about: { type: [String], default: [] },
    facts: { type: [factSchema], default: [] },
    curriculum: { type: [weekSchema], default: [] },
    places: str(false),
    assessmentNote: str(false),
    deliveryMode: { type: String, enum: DELIVERY_MODES, required: true },
    location: str(),
    status: { type: String, enum: OPPORTUNITY_STATUSES, required: true },
    mentorSlugs: { type: [String], default: [] },
    resourceIds: { type: [String], default: [] },
    ...placement,
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const TalentLabEvent = model<ITalentLabEvent>("TalentLabEvent", eventSchema);
export const TalentLabOpportunity = model<ITalentLabOpportunity>("TalentLabOpportunity", opportunitySchema);
export const TalentLabMentor = model<ITalentLabMentor>("TalentLabMentor", mentorSchema);
export const TalentLabProgram = model<ITalentLabProgram>("TalentLabProgram", programSchema);
