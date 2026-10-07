import { Types } from "mongoose";
import DistributionEnquiry from "../models/distributionEnquiry.model.js";

/*
  Allowed values for the form's fixed vocabularies. These must match
  iffa-2026's `src/modules/distribution-enquiry/data/form-options.ts` — a value
  added there without being added here is rejected with a 400.
*/
const ROLES = new Set(["producer", "director", "sales-agent", "rights-holder", "other"]);
const PRODUCTION_STATUSES = new Set(["completed", "post-production", "production"]);
const RIGHTS = new Set(["theatrical", "tv", "svod", "tvod", "non-theatrical", "all"]);
const TERRITORIES = new Set([
  "worldwide",
  "anz",
  "asia",
  "mena",
  "europe",
  "north-america",
  "latin-america",
  "africa",
]);
const DELIVERABLES = new Set([
  "dcp",
  "prores",
  "english-subtitles",
  "me-track",
  "trailer",
  "key-art",
]);

const SYNOPSIS_MAX = 1000;
const TEXT_MAX = 2000;
const POPULATE = "contentType genreIds country language";

const refFields = ["contentType", "country", "language"] as const;

function isValidObjectId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Types.ObjectId.isValid(value);
}

function text(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Keeps only allowed values, de-duplicated. Anything else is dropped. */
function pickAllowed(value: unknown, allowed: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(text).filter((v) => allowed.has(v)))];
}

const badRequest = (res, message: string) =>
  res.status(400).json({ success: false, message });

export const getDistributionEnquiries = async (req, res) => {
  try {
    const items = await DistributionEnquiry.find().sort({ createdAt: -1 }).populate(POPULATE);
    res.status(200).json({
      success: true,
      message: "Distribution enquiries fetched successfully",
      data: items,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getDistributionEnquiryById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(404).json({ success: false, message: "Distribution enquiry not found" });
    }
    const item = await DistributionEnquiry.findById(id).populate(POPULATE);
    if (!item) {
      return res.status(404).json({ success: false, message: "Distribution enquiry not found" });
    }
    res.status(200).json({
      success: true,
      message: "Distribution enquiry fetched successfully",
      data: item,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const createDistributionEnquiryPublic = async (req, res) => {
  try {
    const body = req.body || {};

    // Honeypot: a field the public form hides from people. Only a bot fills it.
    // Answer as if it worked so the bot has nothing to learn from.
    if (text(body.homepage) !== "") {
      return res.status(201).json({
        success: true,
        message: "Distribution enquiry created successfully",
      });
    }

    const requiredStrings = [
      "name",
      "email",
      "company",
      "role",
      "title",
      "productionStatus",
      "synopsis",
      "screenerUrl",
    ] as const;
    for (const key of requiredStrings) {
      if (text(body[key]) === "") {
        return badRequest(res, `Missing or empty required field: ${key}`);
      }
    }

    const optionalStrings = [
      "phone",
      "website",
      "festivals",
      "territoriesSold",
      "screenerPassword",
      "trailerUrl",
      "notes",
    ] as const;
    for (const key of [...requiredStrings, ...optionalStrings]) {
      if (text(body[key]).length > TEXT_MAX) {
        return badRequest(res, `${key} is too long`);
      }
    }

    const email = text(body.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return badRequest(res, "Invalid email");
    }

    const synopsis = text(body.synopsis);
    if (synopsis.length > SYNOPSIS_MAX) {
      return badRequest(res, `synopsis must be ${SYNOPSIS_MAX} characters or fewer`);
    }

    const role = text(body.role);
    if (!ROLES.has(role)) return badRequest(res, "Invalid role");

    const productionStatus = text(body.productionStatus);
    if (!PRODUCTION_STATUSES.has(productionStatus)) {
      return badRequest(res, "Invalid productionStatus");
    }

    const screenerUrl = text(body.screenerUrl);
    if (!isHttpUrl(screenerUrl)) return badRequest(res, "Invalid screenerUrl");
    for (const key of ["website", "trailerUrl"] as const) {
      const value = text(body[key]);
      if (value !== "" && !isHttpUrl(value)) return badRequest(res, `Invalid ${key}`);
    }

    const runtimeMinutes = Number(body.runtimeMinutes);
    if (!Number.isInteger(runtimeMinutes) || runtimeMinutes < 1 || runtimeMinutes > 999) {
      return badRequest(res, "runtimeMinutes must be a whole number of minutes");
    }

    const maxYear = new Date().getFullYear() + 5;
    const year = Number(body.year);
    if (!Number.isInteger(year) || year < 1900 || year > maxYear) {
      return badRequest(res, `year must be between 1900 and ${maxYear}`);
    }

    for (const key of refFields) {
      if (!isValidObjectId(body[key])) {
        return badRequest(res, `Missing or invalid ${key} (must be a valid ID)`);
      }
    }

    const genreIds: string[] = Array.isArray(body.genreIds)
      ? [...new Set<string>(body.genreIds.filter((g) => isValidObjectId(g)))]
      : [];
    if (genreIds.length === 0) {
      return badRequest(res, "At least one genre is required (genreIds[] array)");
    }

    const rights = pickAllowed(body.rights, RIGHTS);
    if (rights.length === 0) return badRequest(res, "At least one right (rights[]) is required");

    const territories = pickAllowed(body.territories, TERRITORIES);
    if (territories.length === 0) {
      return badRequest(res, "At least one territory (territories[]) is required");
    }

    if (body.rightsConfirmed !== true) {
      return badRequest(res, "rightsConfirmed must be true");
    }

    const enquiry = await DistributionEnquiry.create({
      name: text(body.name),
      email,
      phone: text(body.phone),
      company: text(body.company),
      role,
      website: text(body.website),
      title: text(body.title),
      contentType: body.contentType,
      genreIds,
      country: body.country,
      language: body.language,
      runtimeMinutes,
      year,
      productionStatus,
      synopsis,
      festivals: text(body.festivals),
      rights,
      territories,
      territoriesSold: text(body.territoriesSold),
      deliverables: pickAllowed(body.deliverables, DELIVERABLES),
      screenerUrl,
      screenerPassword: text(body.screenerPassword),
      trailerUrl: text(body.trailerUrl),
      notes: text(body.notes),
      rightsConfirmed: true,
    });

    // Only the id goes back: the response reaches the public browser, and the
    // stored record holds nothing the submitter needs to see again.
    res.status(201).json({
      success: true,
      message: "Distribution enquiry created successfully",
      data: { _id: enquiry._id },
    });
  } catch (error: any) {
    if (error?.name === "ValidationError") {
      return badRequest(res, error.message || "Validation failed");
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const deleteDistributionEnquiry = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(404).json({ success: false, message: "Distribution enquiry not found" });
    }
    const deleted = await DistributionEnquiry.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Distribution enquiry not found" });
    }
    res.status(200).json({ success: true, message: "Distribution enquiry deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
