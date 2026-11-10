import { randomInt } from "crypto";
import { Types } from "mongoose";
import type { Request, Response } from "express";

import TalentLabApplication, {
  APPLICATION_STATUSES,
  type ApplicationStatus,
} from "../models/talentLabApplication.model.js";
import TalentLabRegistration from "../models/talentLabRegistration.model.js";
import {
  sendTalentLabApplicationEmails,
  sendTalentLabRegistrationEmails,
} from "../libs/mailer.js";

/*
  Talent Lab Apply and Register forms (iffa-2026 /talent-lab/apply and
  /talent-lab/register). Until this existed both forms showed a success screen
  and sent nothing anywhere.

  The fixed vocabularies must match iffa-2026's
  `talent-lab/data/form-options.ts`; a value added there without being added
  here is rejected with a 400 that names the field. Program names are not
  checked against a list: programs are still defined in the site's code
  (phase 2 moves them here), so only their shape is validated.
*/
const DISCIPLINES = new Set([
  "Directing",
  "Producing",
  "Writing",
  "Acting",
  "Documentary",
  "Crew & technical",
  "Other",
]);
const CAREER_STAGES = new Set([
  "Student / recent graduate",
  "Emerging (0–2 credits)",
  "Early career (3+ credits)",
]);
const AVAILABILITY = new Set([
  "Available for all scheduled sessions",
  "Available for most sessions",
  "Some conflicts — will explain",
]);
const DEMOGRAPHIC = new Set(["", "Prefer not to say", "Yes", "No"]);
const STATES = new Set([
  "Australian Capital Territory",
  "New South Wales",
  "Northern Territory",
  "Queensland",
  "South Australia",
  "Tasmania",
  "Victoria",
  "Western Australia",
]);

const SHORT_MAX = 200;
const TEXT_MAX = 4000;
const BIO_MAX_WORDS = 200;
const PROGRAMS_MAX = 20;

/** Fields kept out of list views and emails. Staff see them on the record only. */
const SENSITIVE_APPLICATION = "-accessRequirements -firstNationsIdentification -regionalRemote";

class FormError extends Error {}

const text = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value).trim();

function required(body: Record<string, unknown>, key: string, max = SHORT_MAX): string {
  const value = text(body[key]);
  if (!value) throw new FormError(`Missing required field: ${key}`);
  if (value.length > max) throw new FormError(`${key} is too long`);
  return value;
}

function optional(body: Record<string, unknown>, key: string, max = TEXT_MAX): string {
  const value = text(body[key]);
  if (value.length > max) throw new FormError(`${key} is too long`);
  return value;
}

function oneOf(value: string, allowed: Set<string>, key: string): string {
  if (!allowed.has(value)) throw new FormError(`${key} is not one of the allowed options`);
  return value;
}

function email(body: Record<string, unknown>): string {
  const value = required(body, "email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new FormError("email is not valid");
  return value;
}

function httpUrl(value: string, key: string): string {
  try {
    const { protocol } = new URL(value);
    if (protocol === "https:" || protocol === "http:") return value;
  } catch {
    // fall through
  }
  throw new FormError(`${key} must be a full link starting with https://`);
}

const words = (value: string) => value.split(/\s+/).filter(Boolean).length;

/** The public form hides a "homepage" field from people. Only a bot fills it. */
const isBot = (body: Record<string, unknown>) => text(body.homepage) !== "";

/** Unambiguous characters only: no 0/O or 1/I/L, so a reference reads back cleanly. */
const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const makeReference = () =>
  "TL-" + Array.from({ length: 6 }, () => REF_ALPHABET[randomInt(REF_ALPHABET.length)]).join("");

const isDuplicateKey = (error: unknown) => (error as { code?: number })?.code === 11000;

/* ------------------------------- public ------------------------------- */

export const createTalentLabApplication = async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (isBot(body)) {
      return res.status(201).json({ success: true, data: { reference: makeReference() } });
    }

    const consents = (body.consents ?? {}) as Record<string, unknown>;
    if (consents.terms !== true || consents.conduct !== true || consents.privacy !== true) {
      throw new FormError("The terms, code of conduct and privacy consents are required");
    }

    const biography = required(body, "biography", TEXT_MAX);
    if (words(biography) > BIO_MAX_WORDS) {
      throw new FormError(`biography must be ${BIO_MAX_WORDS} words or fewer`);
    }
    const secondaryDiscipline = optional(body, "secondaryDiscipline", SHORT_MAX);
    if (secondaryDiscipline) oneOf(secondaryDiscipline, DISCIPLINES, "secondaryDiscipline");

    const fields = {
      program: required(body, "program"),
      fullName: required(body, "fullName"),
      email: email(body),
      phone: required(body, "phone", 40),
      location: required(body, "location"),
      primaryDiscipline: oneOf(required(body, "primaryDiscipline"), DISCIPLINES, "primaryDiscipline"),
      secondaryDiscipline,
      careerStage: oneOf(required(body, "careerStage"), CAREER_STAGES, "careerStage"),
      biography,
      careerObjective: required(body, "careerObjective", TEXT_MAX),
      projectDescription: required(body, "projectDescription", TEXT_MAX),
      whyThisProgram: required(body, "whyThisProgram", TEXT_MAX),
      portfolioLink: httpUrl(required(body, "portfolioLink", 1000), "portfolioLink"),
      availability: oneOf(required(body, "availability"), AVAILABILITY, "availability"),
      previousPrograms: optional(body, "previousPrograms"),
      accessRequirements: optional(body, "accessRequirements"),
      firstNationsIdentification: oneOf(
        optional(body, "firstNationsIdentification", SHORT_MAX),
        DEMOGRAPHIC,
        "firstNationsIdentification",
      ),
      regionalRemote: oneOf(optional(body, "regionalRemote", SHORT_MAX), DEMOGRAPHIC, "regionalRemote"),
      consents: { terms: true, conduct: true, privacy: true, media: consents.media === true },
    };

    // A clash on the 6-character reference is vanishingly rare; retry anyway
    // rather than turn an applicant away.
    let created;
    for (let attempt = 0; !created; attempt += 1) {
      try {
        created = await TalentLabApplication.create({ ...fields, reference: makeReference() });
      } catch (error) {
        if (!isDuplicateKey(error) || attempt >= 4) throw error;
      }
    }

    // After the save, never before: an email failure must not lose the record.
    void sendTalentLabApplicationEmails({
      id: String(created._id),
      reference: created.reference,
      fullName: created.fullName,
      email: created.email,
      program: created.program,
      primaryDiscipline: created.primaryDiscipline,
      careerStage: created.careerStage,
      location: created.location,
    }).catch((error) => console.error("Talent Lab application email failed:", error));

    // Only the reference goes back to the public browser.
    res.status(201).json({ success: true, data: { reference: created.reference } });
  } catch (error) {
    if (error instanceof FormError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("createTalentLabApplication failed:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const createTalentLabRegistration = async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (isBot(body)) return res.status(201).json({ success: true });

    if (body.privacyConsent !== true) throw new FormError("Privacy consent is required");

    const portfolio = optional(body, "portfolioLink", 1000);
    const programs = Array.isArray(body.programs) ? body.programs.map(text).filter(Boolean) : [];
    if (programs.length > PROGRAMS_MAX || programs.some((p) => p.length > SHORT_MAX)) {
      throw new FormError("programs is not valid");
    }

    const created = await TalentLabRegistration.create({
      fullName: required(body, "fullName"),
      email: email(body),
      state: oneOf(required(body, "state"), STATES, "state"),
      discipline: oneOf(required(body, "discipline"), DISCIPLINES, "discipline"),
      careerStage: oneOf(required(body, "careerStage"), CAREER_STAGES, "careerStage"),
      portfolioLink: portfolio ? httpUrl(portfolio, "portfolioLink") : "",
      programs,
      accessRequirements: optional(body, "accessRequirements"),
      mailingList: body.mailingList === true,
      privacyConsent: true,
    });

    void sendTalentLabRegistrationEmails({
      id: String(created._id),
      fullName: created.fullName,
      email: created.email,
      state: created.state,
      discipline: created.discipline,
      careerStage: created.careerStage,
      programs: created.programs,
      mailingList: created.mailingList,
    }).catch((error) => console.error("Talent Lab registration email failed:", error));

    res.status(201).json({ success: true });
  } catch (error) {
    if (error instanceof FormError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("createTalentLabRegistration failed:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* -------------------------------- staff ------------------------------- */

const notFound = (res: Response, what: string) =>
  res.status(404).json({ success: false, message: `${what} not found` });

const serverError = (res: Response, error: unknown) => {
  console.error(error);
  res.status(500).json({ success: false, message: "Internal server error" });
};

export const listTalentLabApplications = async (req: Request, res: Response) => {
  try {
    const filter: Record<string, unknown> = {};
    const status = text(req.query.status);
    if (status && (APPLICATION_STATUSES as readonly string[]).includes(status)) filter.status = status;
    const program = text(req.query.program);
    if (program) filter.program = program;

    const data = await TalentLabApplication.find(filter)
      .select(`${SENSITIVE_APPLICATION} -biography -careerObjective -projectDescription -whyThisProgram`)
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();
    res.status(200).json({ success: true, data });
  } catch (error) {
    serverError(res, error);
  }
};

export const getTalentLabApplication = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) return notFound(res, "Application");
    const data = await TalentLabApplication.findById(id).lean();
    if (!data) return notFound(res, "Application");
    res.status(200).json({ success: true, data });
  } catch (error) {
    serverError(res, error);
  }
};

export const updateTalentLabApplication = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) return notFound(res, "Application");
    const body = (req.body ?? {}) as Record<string, unknown>;

    const updates: { status?: ApplicationStatus; staffNotes?: string } = {};
    if (body.status !== undefined) {
      const status = text(body.status);
      if (!(APPLICATION_STATUSES as readonly string[]).includes(status)) {
        return res.status(400).json({ success: false, message: "status is not valid" });
      }
      updates.status = status as ApplicationStatus;
    }
    if (body.staffNotes !== undefined) {
      const notes = text(body.staffNotes);
      if (notes.length > TEXT_MAX) {
        return res.status(400).json({ success: false, message: "staffNotes is too long" });
      }
      updates.staffNotes = notes;
    }

    const data = await TalentLabApplication.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
    if (!data) return notFound(res, "Application");
    res.status(200).json({ success: true, data });
  } catch (error) {
    serverError(res, error);
  }
};

export const deleteTalentLabApplication = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) return notFound(res, "Application");
    const deleted = await TalentLabApplication.findByIdAndDelete(id);
    if (!deleted) return notFound(res, "Application");
    res.status(200).json({ success: true });
  } catch (error) {
    serverError(res, error);
  }
};

export const listTalentLabRegistrations = async (_req: Request, res: Response) => {
  try {
    const data = await TalentLabRegistration.find()
      .select("-accessRequirements")
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();
    res.status(200).json({ success: true, data });
  } catch (error) {
    serverError(res, error);
  }
};

export const getTalentLabRegistration = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) return notFound(res, "Registration");
    const data = await TalentLabRegistration.findById(id).lean();
    if (!data) return notFound(res, "Registration");
    res.status(200).json({ success: true, data });
  } catch (error) {
    serverError(res, error);
  }
};

export const deleteTalentLabRegistration = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) return notFound(res, "Registration");
    const deleted = await TalentLabRegistration.findByIdAndDelete(id);
    if (!deleted) return notFound(res, "Registration");
    res.status(200).json({ success: true });
  } catch (error) {
    serverError(res, error);
  }
};
