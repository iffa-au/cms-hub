import crypto from "node:crypto";
import { z } from "zod";
import ChatQuestion, { CHAT_SOURCES, CHAT_STATUSES, RETENTION_DAYS } from "../models/chatQuestion.model.js";

/*
  The IFFA Assistant's question log.

  Website side (iffa-2026's server, src/modules/chatbot/lib/insights.ts). Not
  public: every call needs the shared secret CHATBOT_INSIGHTS_KEY in the
  X-Chatbot-Key header (requireChatbotKey), so nobody else can write to it.
    POST   /                 log one question + answer; answers { id }
    PATCH  /:id/feedback     the visitor's 👍 / 👎 on that answer

  Admin side (requireRole("admin") in the router), for the CMS "Chatbot insights" page:
    GET    /                 paged list (filters, search) or ?format=csv
    GET    /report           aggregated numbers
    PATCH  /status           mark every question with the same wording done / ignored / open
    DELETE /:id              delete one question (junk, tests)
*/

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_MS = 366 * DAY_MS;

/**
 * The time window asked for, as a createdAt filter:
 *   ?from=<ISO>&to=<ISO>   from the CMS date picker (the browser turns the
 *                          chosen days into exact start / end times in the
 *                          admin's own time zone); either may be left out
 *   ?days=N                the last N days (1-365)
 * Nothing valid -> `fallbackDays` (or no filter when that is 0).
 */
function period(query, fallbackDays = 0): { createdAt?: { $gte?: Date; $lte?: Date } } {
  const from = query.from ? new Date(String(query.from)) : null;
  const to = query.to ? new Date(String(query.to)) : null;
  const valid = (d: Date | null) => d !== null && !Number.isNaN(d.getTime());
  if (valid(from) || valid(to)) {
    const range: { $gte?: Date; $lte?: Date } = {};
    if (valid(from)) range.$gte = from!;
    if (valid(to)) range.$lte = to!;
    if (range.$gte && range.$lte && range.$gte > range.$lte) [range.$gte, range.$lte] = [range.$lte, range.$gte];
    // One year at most, so nobody can ask the database for everything at once.
    if (range.$lte && (!range.$gte || range.$lte.getTime() - range.$gte.getTime() > MAX_RANGE_MS)) {
      range.$gte = new Date(range.$lte.getTime() - MAX_RANGE_MS);
    }
    return { createdAt: range };
  }
  const days = Number(query.days) || fallbackDays;
  if (days >= 1) return { createdAt: { $gte: new Date(Date.now() - Math.min(days, 365) * DAY_MS) } };
  return {};
}

/** Compares secrets in constant time, so the key can't be guessed by timing the replies. */
function sameSecret(given: unknown, expected: string | undefined): boolean {
  if (!expected || expected.length < 20 || typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Middleware: only iffa-2026's server, which knows CHATBOT_INSIGHTS_KEY, gets through. */
export function requireChatbotKey(req, res, next) {
  if (sameSecret(req.header("X-Chatbot-Key"), process.env.CHATBOT_INSIGHTS_KEY)) return next();
  res.status(401).json({ success: false, message: "Unauthorized" });
}

const isObjectId = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{24}$/i.test(v);

/** Escapes text for use inside a RegExp, so a search for "fee?" means the literal "fee?". */
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A site path like "/submit-film"; anything else (full URLs, junk) becomes "". */
const sitePath = z
  .string()
  .max(200)
  .optional()
  .default("")
  .transform((p) => (/^\/[\w\-./]*$/.test(p) ? p : ""));

const questionBody = z.object({
  question: z.string().trim().min(1).max(1000),
  answer: z.string().max(6000).optional().default(""),
  answered: z.boolean(),
  source: z.enum(CHAT_SOURCES),
  page: sitePath,
});

export const createChatQuestion = async (req, res) => {
  const parsed = questionBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "Invalid chatbot question" });
  }
  try {
    const doc = await ChatQuestion.create(parsed.data);
    res.status(201).json({ success: true, id: String(doc._id) });
  } catch (error) {
    console.error("Failed to save chatbot question:", error);
    res.status(500).json({ success: false, message: "Failed to save chatbot question" });
  }
};

/** PATCH /:id/feedback { helpful: true | false }. The website checks the visitor owns that answer. */
export const setChatQuestionFeedback = async (req, res) => {
  if (!isObjectId(req.params.id) || typeof req.body?.helpful !== "boolean") {
    return res.status(400).json({ success: false, message: "Invalid feedback" });
  }
  try {
    const updated = await ChatQuestion.findByIdAndUpdate(req.params.id, {
      feedback: req.body.helpful ? "up" : "down",
      feedbackAt: new Date(),
    });
    if (!updated) return res.status(404).json({ success: false, message: "Question not found" });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to save chatbot feedback:", error);
    res.status(500).json({ success: false, message: "Failed to save feedback" });
  }
};

/**
 * PATCH /status { normalized, status }: marks every question asked that way
 * (same `normalized`) as done / ignored / open, so the group leaves the
 * "Not answered" to-do list together.
 */
export const setChatQuestionStatus = async (req, res) => {
  const { normalized, status } = req.body ?? {};
  if (typeof normalized !== "string" || !normalized || !CHAT_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status update" });
  }
  try {
    const result = await ChatQuestion.updateMany({ normalized }, { status });
    res.status(200).json({ success: true, updated: result.modifiedCount });
  } catch (error) {
    console.error("Failed to update chatbot question status:", error);
    res.status(500).json({ success: false, message: "Failed to update status" });
  }
};

export const deleteChatQuestion = async (req, res) => {
  if (!isObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id" });
  try {
    const deleted = await ChatQuestion.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Question not found" });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to delete chatbot question:", error);
    res.status(500).json({ success: false, message: "Failed to delete question" });
  }
};

/** The list filter shared by the paged list and the CSV export. */
function listFilter(query): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (query.answered === "true" || query.answered === "false") filter.answered = query.answered === "true";
  if (CHAT_SOURCES.includes(query.source)) filter.source = query.source;
  if (CHAT_STATUSES.includes(query.status)) filter.status = query.status;
  if (query.feedback === "up" || query.feedback === "down") filter.feedback = query.feedback;
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 100) : "";
  if (q) filter.question = { $regex: escapeRegExp(q), $options: "i" };
  return { ...filter, ...period(query) };
}

const LIST_FIELDS = "question answer answered source normalized page feedback status createdAt";

/** One CSV cell: quoted, inner quotes doubled, and a leading = + - @ neutralised so spreadsheets don't run it as a formula. */
const csvCell = (v: unknown) => {
  let s = v instanceof Date ? v.toISOString() : String(v ?? "");
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

/**
 * GET /chatbot-questions?page=1&limit=20&answered=false&source=ai&status=open&feedback=down&q=ticket&from=...&to=...
 * (or &days=30 instead of from / to; see period())
 * One page of individual questions with the answer the bot gave, newest first.
 * All filters are optional. Response: { data, meta: { page, limit, total } }.
 * With &format=csv: the same filter as a CSV download (newest 10,000).
 */
export const getChatQuestions = async (req, res) => {
  const filter = listFilter(req.query);

  try {
    if (req.query.format === "csv") {
      const rows = await ChatQuestion.find(filter).sort({ createdAt: -1, _id: -1 }).limit(10_000).select(LIST_FIELDS).lean();
      const header = ["Asked at", "Question", "Answer", "Answered", "Source", "Page", "Feedback", "Status"];
      const lines = rows.map((r) =>
        [r.createdAt, r.question, r.answer, r.answered ? "yes" : "no", r.source, r.page, r.feedback, r.status]
          .map(csvCell)
          .join(","),
      );
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="chatbot-questions.csv"');
      return res.status(200).send("﻿" + [header.map(csvCell).join(","), ...lines].join("\r\n"));
    }

    const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1), 100);
    const [items, total] = await Promise.all([
      ChatQuestion.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select(LIST_FIELDS)
        .lean(),
      ChatQuestion.countDocuments(filter),
    ]);
    res.status(200).json({
      success: true,
      message: "Chatbot questions fetched successfully",
      data: items,
      meta: { page, limit, total },
    });
  } catch (error) {
    console.error("Failed to list chatbot questions:", error);
    res.status(500).json({ success: false, message: "Failed to list chatbot questions" });
  }
};

/**
 * GET /chatbot-questions/report?from=<ISO>&to=<ISO>  (or ?days=7, the default; see period())
 * Most asked, not answered (open only: the to-do list), disliked answers,
 * template candidates, how questions were answered, feedback totals and
 * questions per day (Melbourne time). Template candidates cover all time, so
 * they don't jump around week to week.
 */
export const getChatQuestionReport = async (req, res) => {
  const recent = period(req.query, 7);

  try {
    const [total, mostAsked, unanswered, disliked, templates, bySource, feedback, perDay] = await Promise.all([
      ChatQuestion.countDocuments(recent),

      // Small talk is left out: it never needs the AI anyway.
      ChatQuestion.aggregate([
        { $match: { ...recent, source: { $ne: "smalltalk" } } },
        {
          $group: {
            _id: "$normalized",
            asked: { $sum: 1 },
            answered: { $sum: { $cond: ["$answered", 1, 0] } },
            example: { $first: "$question" },
          },
        },
        { $sort: { asked: -1 } },
        { $limit: 20 },
      ]),

      ChatQuestion.aggregate([
        { $match: { ...recent, answered: false, status: { $nin: ["done", "ignored"] } } },
        {
          $group: {
            _id: "$normalized",
            asked: { $sum: 1 },
            example: { $first: "$question" },
            lastAsked: { $max: "$createdAt" },
          },
        },
        { $sort: { asked: -1 } },
        { $limit: 20 },
      ]),

      ChatQuestion.aggregate([
        { $match: { ...recent, feedback: "down", status: { $nin: ["done", "ignored"] } } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: "$normalized",
            votes: { $sum: 1 },
            example: { $first: "$question" },
            answer: { $first: "$answer" },
            lastAsked: { $first: "$createdAt" },
          },
        },
        { $sort: { votes: -1, lastAsked: -1 } },
        { $limit: 20 },
      ]),

      ChatQuestion.aggregate([
        { $match: { answered: true, source: { $in: ["ai", "cache"] } } },
        { $sort: { createdAt: 1 } },
        {
          $group: {
            _id: "$normalized",
            asked: { $sum: 1 },
            answer: { $last: "$answer" },
            example: { $first: "$question" },
          },
        },
        { $match: { asked: { $gte: 3 } } },
        { $sort: { asked: -1 } },
        { $limit: 10 },
      ]),

      ChatQuestion.aggregate([
        { $match: recent },
        { $group: { _id: "$source", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      ChatQuestion.aggregate([
        { $match: { ...recent, feedback: { $in: ["up", "down"] } } },
        { $group: { _id: "$feedback", count: { $sum: 1 } } },
      ]),

      ChatQuestion.aggregate([
        { $match: recent },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Australia/Melbourne" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const votes = (k: string) => feedback.find((f) => f._id === k)?.count ?? 0;
    res.status(200).json({
      success: true,
      message: "Chatbot report fetched successfully",
      data: {
        from: recent.createdAt?.$gte ?? null,
        to: recent.createdAt?.$lte ?? null,
        retentionDays: RETENTION_DAYS,
        total,
        unansweredTotal: unanswered.reduce((n, q) => n + q.asked, 0),
        feedback: { up: votes("up"), down: votes("down") },
        mostAsked: mostAsked.map((q) => ({ normalized: q._id, question: q.example, asked: q.asked, answered: q.answered })),
        unanswered: unanswered.map((q) => ({
          normalized: q._id,
          question: q.example,
          asked: q.asked,
          lastAsked: q.lastAsked,
        })),
        disliked: disliked.map((q) => ({
          normalized: q._id,
          question: q.example,
          answer: q.answer,
          votes: q.votes,
          lastAsked: q.lastAsked,
        })),
        templates: templates.map((t) => ({ normalized: t._id, question: t.example, asked: t.asked, answer: t.answer })),
        bySource: bySource.map((s) => ({ source: s._id, count: s.count })),
        perDay: perDay.map((d) => ({ day: d._id, count: d.count })),
      },
    });
  } catch (error) {
    console.error("Failed to build chatbot report:", error);
    res.status(500).json({ success: false, message: "Failed to build chatbot report" });
  }
};
