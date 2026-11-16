import { Schema, model } from "mongoose";

/**
 * A request to attend the IFFA awards night, from the public `/attend-event`
 * form on iffa-2026.
 *
 * Two halves, kept apart on purpose:
 *
 * - Everything the registrant typed. Written once by the public POST and only
 *   ever read back by admins.
 * - The `admin*` / `status` / `passType` / `checkedIn*` fields. Set by staff in
 *   the CMS, never accepted from the public route and never returned to it.
 *   The public POST answers with a message only, so a registrant learns
 *   nothing about the guest list, their own status included.
 *
 * Remember the Mongoose trap (AGENTS.md): a field that is only in the
 * interface is silently dropped. Add new fields to both.
 */

export const ATTENDEE_TYPES = ["influencer", "media", "audience"] as const;
export type AttendeeType = (typeof ATTENDEE_TYPES)[number];

export const REGISTRATION_STATUSES = [
  "pending",
  "approved",
  "waitlisted",
  "declined",
] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const PASS_TYPES = ["", "general", "vip", "press", "creator", "guest"] as const;
export type PassType = (typeof PASS_TYPES)[number];

export const SOCIAL_PLATFORMS = ["instagram", "youtube", "other"] as const;


export const MEDIA_TYPES = [
  "print",
  "online",
  "television",
  "radio",
  "podcast",
  "photography",
  "agency",
  "other",
] as const;

export interface IEventRegistration {
  attendeeType: AttendeeType;

  // Everyone
  fullName: string;
  email: string;
  phone: string;
  accessibilityNeeds?: string;
  comments?: string;
  consent: boolean;

  // Influencer: one platform, one username or profile link
  socialPlatform?: string;
  socialHandle?: string;
  contentNiche?: string;

  // Media
  media?: {
    outlet?: string;
    mediaType?: string;
    roleTitle?: string;
    outletWebsite?: string;
    pressId?: string;
    editorName?: string;
    editorEmail?: string;
    editorPhone?: string;
    coveragePlan?: string;
    crewCount?: number;
  };

  // General audience
  guests?: number;

  // Admin only — never accepted from, or returned to, the public route.
  status: RegistrationStatus;
  passType?: PassType;
  seatOrTable?: string;
  adminNotes?: string;
  checkedIn: boolean;
  checkedInAt?: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}

const trimmed = { type: String, trim: true, default: "" } as const;

const eventRegistrationSchema = new Schema<IEventRegistration>(
  {
    attendeeType: { type: String, enum: ATTENDEE_TYPES, required: true },

    fullName: { type: String, trim: true, required: true },
    email: { type: String, trim: true, lowercase: true, required: true },
    phone: { type: String, trim: true, required: true },
    accessibilityNeeds: trimmed,
    comments: trimmed,
    consent: { type: Boolean, required: true },

    socialPlatform: trimmed,
    socialHandle: trimmed,
    contentNiche: trimmed,

    media: {
      outlet: trimmed,
      mediaType: trimmed,
      roleTitle: trimmed,
      outletWebsite: trimmed,
      pressId: trimmed,
      editorName: trimmed,
      editorEmail: trimmed,
      editorPhone: trimmed,
      coveragePlan: trimmed,
      crewCount: { type: Number, min: 0, max: 10, default: 0 },
    },

    guests: { type: Number, min: 0, max: 5, default: 0 },

    status: {
      type: String,
      enum: REGISTRATION_STATUSES,
      default: "pending",
      index: true,
    },
    passType: { type: String, enum: PASS_TYPES, default: "" },
    seatOrTable: trimmed,
    adminNotes: trimmed,
    checkedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// One registration per email per attendee type. A second submission is
// answered exactly like the first so the public form can't be used to test
// whether someone is on the list.
eventRegistrationSchema.index({ email: 1, attendeeType: 1 }, { unique: true });

const EventRegistration = model<IEventRegistration>(
  "EventRegistration",
  eventRegistrationSchema,
);
export default EventRegistration;
