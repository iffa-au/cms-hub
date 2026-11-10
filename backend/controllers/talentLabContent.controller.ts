import { Types, type Model } from "mongoose";
import type { Request, Response } from "express";

import {
  TalentLabEvent,
  TalentLabMentor,
  TalentLabOpportunity,
  CAREER_STAGES,
  DELIVERY_MODES,
  DISCIPLINES,
  EVENT_STATES,
  MENTOR_TYPES,
  OPPORTUNITY_STATUSES,
} from "../models/talentLabContent.model.js";

/*
  Events, Opportunities and Mentors share one controller. Each kind is
  described once below — its fields, its unique key, and how it is published —
  and gets the same routes:

    GET    /talent-lab/<kind>             public: published, ordered, site shape
    GET    /talent-lab/<kind>/manage      staff: everything, with _id/order/isPublished
    GET    /talent-lab/<kind>/manage/:id  staff
    POST   /talent-lab/<kind>             staff
    PUT    /talent-lab/<kind>/order       staff: { ids: [...] } in display order
    PUT    /talent-lab/<kind>/:id         staff
    DELETE /talent-lab/<kind>/:id         staff

  The public shape is iffa-2026's `talent-lab/lib/types.ts`, field for field.
*/

type Field =
  | { key: string; kind: "text"; required?: boolean; max?: number }
  | { key: string; kind: "enum"; values: readonly string[] }
  | { key: string; kind: "tags" }
  | { key: string; kind: "optionalUrl" };

type Kind = {
  label: string;
  // Each kind has its own document type; the controller only reads and writes
  // the fields listed below, so the shared code treats them uniformly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>;
  /** Stored unique key, and the name the site knows it by. */
  keyField: string;
  publicKey: string;
  fields: Field[];
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHORT = 200;
const LONG = 4000;

export const KINDS: Record<"events" | "opportunities" | "mentors", Kind> = {
  events: {
    label: "Event",
    model: TalentLabEvent,
    keyField: "slug",
    publicKey: "slug",
    fields: [
      { key: "title", kind: "text", required: true },
      { key: "when", kind: "text", required: true },
      { key: "format", kind: "text", required: true },
      { key: "speakerName", kind: "text", required: true },
      { key: "speakerRole", kind: "text", required: true },
      { key: "mode", kind: "text", required: true },
      { key: "state", kind: "enum", values: EVENT_STATES },
      { key: "description", kind: "text", required: true, max: LONG },
      { key: "registerHref", kind: "optionalUrl" },
    ],
  },
  opportunities: {
    label: "Opportunity",
    model: TalentLabOpportunity,
    keyField: "opportunityId",
    publicKey: "id",
    fields: [
      { key: "streamSlug", kind: "text", required: true },
      { key: "title", kind: "text", required: true },
      { key: "summary", kind: "text", required: true, max: LONG },
      { key: "status", kind: "enum", values: OPPORTUNITY_STATUSES },
      { key: "tags", kind: "tags" },
      { key: "discipline", kind: "enum", values: DISCIPLINES },
      { key: "stage", kind: "enum", values: CAREER_STAGES },
      { key: "deliveryMode", kind: "enum", values: DELIVERY_MODES },
      { key: "modeLabel", kind: "text", required: true },
      { key: "opensOn", kind: "text", required: true },
      { key: "closesOn", kind: "text", required: true },
      { key: "programDates", kind: "text", required: true },
      { key: "cycle", kind: "text", required: true },
      { key: "ctaLabel", kind: "text", required: true },
    ],
  },
  mentors: {
    label: "Mentor",
    model: TalentLabMentor,
    keyField: "slug",
    publicKey: "slug",
    fields: [
      { key: "name", kind: "text", required: true },
      { key: "role", kind: "text", required: true },
      { key: "organisation", kind: "text", required: true },
      { key: "country", kind: "text", required: true },
      { key: "type", kind: "enum", values: MENTOR_TYPES },
      { key: "discipline", kind: "enum", values: DISCIPLINES },
      { key: "year", kind: "text", required: true },
      { key: "bio", kind: "text", required: true, max: LONG },
    ],
  },
};

class InputError extends Error {}

const text = (value: unknown) => (value === undefined || value === null ? "" : String(value).trim());

/** Validates a staff payload into the fields to store. Throws InputError naming the field. */
export function normalise(kind: Kind, body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const key = text(body[kind.publicKey] ?? body[kind.keyField]);
  if (!key || !SLUG.test(key) || key.length > 120) {
    throw new InputError(`${kind.publicKey} must be lowercase letters, numbers and hyphens, e.g. "pitching-masterclass"`);
  }
  out[kind.keyField] = key;

  for (const field of kind.fields) {
    const raw = body[field.key];
    if (field.kind === "text") {
      const value = text(raw);
      if (field.required && !value) throw new InputError(`${field.key} is required`);
      if (value.length > (field.max ?? SHORT)) throw new InputError(`${field.key} is too long`);
      out[field.key] = value;
    } else if (field.kind === "enum") {
      const value = text(raw);
      if (!field.values.includes(value)) {
        throw new InputError(`${field.key} must be one of: ${field.values.join(", ")}`);
      }
      out[field.key] = value;
    } else if (field.kind === "tags") {
      const list = Array.isArray(raw) ? raw : text(raw).split(",");
      const tags = list.map(text).filter(Boolean);
      if (tags.length > 12 || tags.some((t) => t.length > 40)) throw new InputError(`${field.key} has too many or too-long tags`);
      out[field.key] = tags;
    } else {
      const value = text(raw);
      if (value) {
        try {
          const { protocol } = new URL(value);
          if (protocol !== "https:" && protocol !== "http:") throw new Error();
        } catch {
          throw new InputError(`${field.key} must be a full link starting with https://, or empty`);
        }
      }
      out[field.key] = value || null;
    }
  }

  if (body.isPublished !== undefined) out.isPublished = body.isPublished === true;
  return out;
}

/** A stored record in the site's shape: no _id, order, publish flag or timestamps. */
export function toPublic(kind: Kind, doc: Record<string, unknown>) {
  const out: Record<string, unknown> = { [kind.publicKey]: doc[kind.keyField] };
  for (const field of kind.fields) {
    out[field.key] = field.kind === "optionalUrl" ? (doc[field.key] || null) : (doc[field.key] ?? (field.kind === "tags" ? [] : ""));
  }
  return out;
}

const toManage = (kind: Kind, doc: Record<string, unknown>) => ({
  _id: String(doc._id),
  ...toPublic(kind, doc),
  order: doc.order ?? 0,
  isPublished: doc.isPublished !== false,
});

function handleError(res: Response, kind: Kind, error: unknown) {
  if (error instanceof InputError) return res.status(400).json({ success: false, message: error.message });
  if ((error as { code?: number })?.code === 11000) {
    return res.status(409).json({ success: false, message: `Another ${kind.label.toLowerCase()} already uses that ${kind.publicKey}` });
  }
  if ((error as { name?: string })?.name === "ValidationError") {
    return res.status(400).json({ success: false, message: (error as Error).message });
  }
  console.error(error);
  res.status(500).json({ success: false, message: "Internal server error" });
}

const SORT = { order: 1, createdAt: 1 } as const;

/** Builds the handlers for one kind. */
export function contentHandlers(kind: Kind) {
  const notFound = (res: Response) =>
    res.status(404).json({ success: false, message: `${kind.label} not found` });

  return {
    /**
     * Public. `configured` is false until staff have created at least one
     * record (published or not), so the site keeps its built-in content until
     * the CMS actually holds something — and an all-unpublished list is
     * respected as "show nothing".
     */
    fetchPublic: async (_req: Request, res: Response) => {
      try {
        const [docs, total] = await Promise.all([
          kind.model.find({ isPublished: { $ne: false } }).sort(SORT).lean(),
          kind.model.estimatedDocumentCount(),
        ]);
        res.status(200).json({
          success: true,
          configured: total > 0,
          data: docs.map((d) => toPublic(kind, d as Record<string, unknown>)),
        });
      } catch (error) {
        handleError(res, kind, error);
      }
    },

    listManage: async (_req: Request, res: Response) => {
      try {
        const docs = await kind.model.find().sort(SORT).lean();
        res.status(200).json({ success: true, data: docs.map((d) => toManage(kind, d as Record<string, unknown>)) });
      } catch (error) {
        handleError(res, kind, error);
      }
    },

    getManage: async (req: Request, res: Response) => {
      try {
        const id = String(req.params.id);
        if (!Types.ObjectId.isValid(id)) return notFound(res);
        const doc = await kind.model.findById(id).lean();
        if (!doc) return notFound(res);
        res.status(200).json({ success: true, data: toManage(kind, doc as Record<string, unknown>) });
      } catch (error) {
        handleError(res, kind, error);
      }
    },

    create: async (req: Request, res: Response) => {
      try {
        const fields = normalise(kind, (req.body ?? {}) as Record<string, unknown>);
        // New records go to the end of the list.
        const last = await kind.model.findOne().sort({ order: -1 }).select("order").lean();
        const order = ((last as { order?: number } | null)?.order ?? -1) + 1;
        const doc = await kind.model.create({ ...fields, order });
        res.status(201).json({ success: true, data: toManage(kind, doc.toObject()) });
      } catch (error) {
        handleError(res, kind, error);
      }
    },

    update: async (req: Request, res: Response) => {
      try {
        const id = String(req.params.id);
        if (!Types.ObjectId.isValid(id)) return notFound(res);
        const fields = normalise(kind, (req.body ?? {}) as Record<string, unknown>);
        const doc = await kind.model.findByIdAndUpdate(id, { $set: fields }, { new: true, runValidators: true }).lean();
        if (!doc) return notFound(res);
        res.status(200).json({ success: true, data: toManage(kind, doc as Record<string, unknown>) });
      } catch (error) {
        handleError(res, kind, error);
      }
    },

    reorder: async (req: Request, res: Response) => {
      try {
        const ids = Array.isArray(req.body?.ids) ? (req.body.ids as unknown[]).map(String) : [];
        if (!ids.length || ids.some((id) => !Types.ObjectId.isValid(id))) {
          return res.status(400).json({ success: false, message: "ids must be a list of record ids" });
        }
        await kind.model.bulkWrite(
          ids.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: index } } } })),
        );
        res.status(200).json({ success: true });
      } catch (error) {
        handleError(res, kind, error);
      }
    },

    remove: async (req: Request, res: Response) => {
      try {
        const id = String(req.params.id);
        if (!Types.ObjectId.isValid(id)) return notFound(res);
        const deleted = await kind.model.findByIdAndDelete(id);
        if (!deleted) return notFound(res);
        res.status(200).json({ success: true });
      } catch (error) {
        handleError(res, kind, error);
      }
    },
  };
}
