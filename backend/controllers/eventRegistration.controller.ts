import { Types } from "mongoose";
import { z } from "zod";
import aj from "../libs/arcjet.js";
import EventRegistration, {
  MEDIA_TYPES,
  PASS_TYPES,
  SOCIAL_PLATFORMS,
  REGISTRATION_STATUSES,
} from "../models/eventRegistration.model.js";

/*
  Public side: one route, POST. It validates against an allow-list, never
  reads an admin field from the body, and answers with a message only — no
  document, no id, no status. A repeat registration gets the same answer as a
  first one, so the form can't be used to probe who is on the guest list.

  Admin side: list / read / update / delete, all behind requireRole("admin")
  in the router.
*/

const PUBLIC_RECEIVED_MESSAGE =
  "Thanks — your registration has been received. We'll be in touch by email.";

const text = (max: number) => z.string().trim().max(max).optional().default("");
const required = (label: string, max = 200) =>
  z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`).max(max);

const base = z.object({
  fullName: required("Full name", 120),
  email: z.email("A valid email is required").trim().max(200),
  phone: required("Contact number", 40),
  accessibilityNeeds: text(500),
  comments: text(1000),
  consent: z.literal(true, { error: "Consent is required" }),
});

const influencer = base.extend({
  attendeeType: z.literal("influencer"),
  socialPlatform: z.enum(SOCIAL_PLATFORMS, { error: "Choose your social media platform" }),
  socialHandle: required("Username or profile link", 300),
  contentNiche: text(120),
});

const media = base.extend({
  attendeeType: z.literal("media"),
  media: z.object({
    outlet: required("Media outlet", 160),
    mediaType: z.enum(MEDIA_TYPES, { error: "Choose a media type" }),
    roleTitle: required("Role / title", 120),
    outletWebsite: text(300),
    pressId: text(120),
    editorName: required("Editor or desk contact name", 120),
    editorEmail: z.email("A valid editor email is required").trim().max(200),
    editorPhone: text(40),
    coveragePlan: text(1000),
    crewCount: z.coerce.number().int().min(0).max(10).optional().default(0),
  }),
});

const audience = base.extend({
  attendeeType: z.literal("audience"),
  guests: z.coerce.number().int().min(0).max(5).optional().default(0),
});

const publicSchema = z.discriminatedUnion("attendeeType", [
  influencer,
  media,
  audience,
]);

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue?.message || "Please check the form and try again";
}

export const createEventRegistrationPublic = async (req, res) => {
  try {
    const body = req.body || {};

    // Honeypot: a hidden field real people never see. Bots that fill it get
    // the normal answer and nothing is stored.
    if (typeof body.homepage === "string" && body.homepage.trim() !== "") {
      return res.status(201).json({ success: true, message: PUBLIC_RECEIVED_MESSAGE });
    }

    const parsed = publicSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: firstIssue(parsed.error) });
    }
    const data = parsed.data;

    try {
      const decision = await aj.protect(req, { email: data.email });
      if (decision.isDenied() && decision.reason.isEmail()) {
        return res.status(400).json({
          success: false,
          message: "That email address can't receive mail. Please use another one.",
        });
      }
    } catch (err) {
      // Arcjet being unreachable shouldn't lose someone's registration.
      console.error("arcjet check failed for event registration", err);
    }

    const existing = await EventRegistration.exists({
      email: data.email.toLowerCase(),
      attendeeType: data.attendeeType,
    });
    if (existing) {
      return res.status(201).json({ success: true, message: PUBLIC_RECEIVED_MESSAGE });
    }

    // Built field by field from the parsed data: nothing from the raw body —
    // and so no admin field — can reach the document.
    await EventRegistration.create({
      attendeeType: data.attendeeType,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      accessibilityNeeds: data.accessibilityNeeds,
      comments: data.comments,
      consent: true,
      ...(data.attendeeType === "influencer" && {
        socialPlatform: data.socialPlatform,
        socialHandle: data.socialHandle,
        contentNiche: data.contentNiche,
      }),
      ...(data.attendeeType === "media" && { media: data.media }),
      ...(data.attendeeType === "audience" && { guests: data.guests }),
    });

    return res.status(201).json({ success: true, message: PUBLIC_RECEIVED_MESSAGE });
  } catch (error: any) {
    // A race between two identical submissions lands here; same answer.
    if (error?.code === 11000) {
      return res.status(201).json({ success: true, message: PUBLIC_RECEIVED_MESSAGE });
    }
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong on our side. Please try again in a few minutes.",
    });
  }
};

/* ─── Admin ──────────────────────────────────────────────────────────────── */

export const getEventRegistrations = async (req, res) => {
  try {
    const filter: Record<string, unknown> = {};
    const { type, status } = req.query;
    if (typeof type === "string" && type) filter.attendeeType = type;
    if (typeof status === "string" && status) filter.status = status;

    const items = await EventRegistration.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .lean();
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getEventRegistrationById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(404).json({ success: false, message: "Registration not found" });
    }
    const item = await EventRegistration.findById(id).lean();
    if (!item) {
      return res.status(404).json({ success: false, message: "Registration not found" });
    }
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const adminUpdateSchema = z
  .object({
    status: z.enum(REGISTRATION_STATUSES),
    passType: z.enum(PASS_TYPES),
    seatOrTable: z.string().trim().max(80),
    adminNotes: z.string().trim().max(2000),
    checkedIn: z.boolean(),
  })
  .partial()
  .strict();

export const updateEventRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(404).json({ success: false, message: "Registration not found" });
    }
    const parsed = adminUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: firstIssue(parsed.error) });
    }
    const update: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.checkedIn === true) update.checkedInAt = new Date();
    if (parsed.data.checkedIn === false) update.checkedInAt = null;

    const item = await EventRegistration.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).lean();
    if (!item) {
      return res.status(404).json({ success: false, message: "Registration not found" });
    }
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const deleteEventRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(404).json({ success: false, message: "Registration not found" });
    }
    const deleted = await EventRegistration.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Registration not found" });
    }
    res.status(200).json({ success: true, message: "Registration deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
