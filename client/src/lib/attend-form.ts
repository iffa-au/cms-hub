import { z } from "zod";

/**
 * The public registration form at /attend (the only CMS page that needs no
 * login). One flat set of values for all three attendee types, so switching
 * type keeps the shared fields; `superRefine` decides what each type must
 * fill. The backend (`eventRegistration.controller.ts`) re-checks the same
 * rules — keep the two in step.
 */

export type AttendeeType = "influencer" | "media" | "audience";

export const ATTENDEE_TYPES: { value: AttendeeType; label: string }[] = [
  { value: "influencer", label: "Creator / influencer" },
  { value: "media", label: "Media / press" },
  { value: "audience", label: "General audience" },
];

export const PLATFORMS = [
  { value: "instagram", label: "Instagram", placeholder: "@username or instagram.com/username" },
  { value: "youtube", label: "YouTube", placeholder: "youtube.com/@channel" },
  { value: "other", label: "Other", placeholder: "Platform and username or link" },
] as const;

export const MEDIA_TYPES = [
  { value: "print", label: "Print" },
  { value: "online", label: "Online / digital" },
  { value: "television", label: "Television" },
  { value: "radio", label: "Radio" },
  { value: "podcast", label: "Podcast" },
  { value: "photography", label: "Photography" },
  { value: "agency", label: "News agency / wire" },
  { value: "other", label: "Other" },
];

export const GUEST_OPTIONS = ["0", "1", "2", "3", "4", "5"].map((n) => ({
  value: n,
  label: n === "0" ? "Just me" : `Me + ${n}`,
}));

export const CREW_OPTIONS = ["0", "1", "2", "3"].map((n) => ({
  value: n,
  label: n === "0" ? "Just me" : `Me + ${n} crew`,
}));

const str = z.string().trim();

export const attendSchema = z
  .object({
    attendeeType: z.enum(["influencer", "media", "audience"]),
    fullName: str.min(2, "Enter your full name."),
    phone: str.regex(/^[+()\d\s-]{6,}$/, "Enter a phone number we can reach you on."),
    email: z.email({ message: "Enter a valid email address." }),
    accessibilityNeeds: str.max(500, "Keep this under 500 characters."),
    comments: str.max(1000, "Keep this under 1000 characters."),
    consent: z.boolean(),

    socialPlatform: str,
    socialHandle: str.max(300, "Keep this under 300 characters."),
    contentNiche: str.max(120, "Keep this under 120 characters."),

    outlet: str,
    mediaType: str,
    roleTitle: str,
    outletWebsite: str,
    pressId: str,
    editorName: str,
    editorEmail: str,
    editorPhone: str,
    coveragePlan: str.max(1000, "Keep this under 1000 characters."),
    crewCount: str,

    guests: str,
  })
  .superRefine((v, ctx) => {
    const need = (path: keyof typeof v, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });

    if (!v.consent) need("consent", "Please agree so we can contact you about the event.");

    if (v.attendeeType === "influencer") {
      if (!v.socialPlatform) need("socialPlatform", "Choose the platform you post on.");
      if (!v.socialHandle) need("socialHandle", "Add your username or profile link.");
    }

    if (v.attendeeType === "media") {
      if (!v.outlet) need("outlet", "Enter the outlet you're representing.");
      if (!v.mediaType) need("mediaType", "Choose a media type.");
      if (!v.roleTitle) need("roleTitle", "Enter your role or title.");
      if (!v.editorName) need("editorName", "Enter your editor or news desk contact.");
      if (!z.email().safeParse(v.editorEmail).success)
        need("editorEmail", "Enter a valid email for your editor or desk.");
    }
  });

export type AttendValues = z.infer<typeof attendSchema>;

export const EMPTY_VALUES: AttendValues = {
  attendeeType: "influencer",
  fullName: "",
  phone: "",
  email: "",
  accessibilityNeeds: "",
  comments: "",
  consent: false,
  socialPlatform: "instagram",
  socialHandle: "",
  contentNiche: "",
  outlet: "",
  mediaType: "",
  roleTitle: "",
  outletWebsite: "",
  pressId: "",
  editorName: "",
  editorEmail: "",
  editorPhone: "",
  coveragePlan: "",
  crewCount: "0",
  guests: "0",
};

/** The body the backend's POST /event-registrations expects. */
export function toPayload(v: AttendValues) {
  const base = {
    attendeeType: v.attendeeType,
    fullName: v.fullName,
    phone: v.phone,
    email: v.email,
    accessibilityNeeds: v.accessibilityNeeds,
    comments: v.comments,
    consent: v.consent,
  };
  if (v.attendeeType === "influencer") {
    return {
      ...base,
      socialPlatform: v.socialPlatform,
      socialHandle: v.socialHandle,
      contentNiche: v.contentNiche,
    };
  }
  if (v.attendeeType === "media") {
    return {
      ...base,
      media: {
        outlet: v.outlet,
        mediaType: v.mediaType,
        roleTitle: v.roleTitle,
        outletWebsite: v.outletWebsite,
        pressId: v.pressId,
        editorName: v.editorName,
        editorEmail: v.editorEmail,
        editorPhone: v.editorPhone,
        coveragePlan: v.coveragePlan,
        crewCount: Number(v.crewCount) || 0,
      },
    };
  }
  return { ...base, guests: Number(v.guests) || 0 };
}
