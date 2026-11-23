import { Schema, model } from "mongoose";

/**
 * One question a visitor asked the IFFA Assistant (the chatbot on iffa-2026),
 * and what it answered. Written by the website's server after each answer
 * (`POST /chatbot-questions`, protected by a shared key) and read only by
 * admins, as a report (`GET /chatbot-questions/report`).
 *
 * What it is for: seeing which questions visitors ask most, which ones the bot
 * couldn't answer (information missing from the site), and which answers are
 * asked often enough to become instant, fixed replies.
 *
 * Privacy: no names, emails, IPs or full conversations. Emails and phone
 * numbers typed into a question are replaced before saving (see the hook), and
 * every document is deleted automatically after RETENTION_DAYS.
 *
 * Remember the Mongoose trap (AGENTS.md): a field that is only in the
 * interface is silently dropped. Add new fields to both.
 */

export const CHAT_SOURCES = ["ai", "cache", "smalltalk", "template"] as const;
export type ChatSource = (typeof CHAT_SOURCES)[number];

/** The visitor's 👍 / 👎 on the answer; "" = no vote. */
export const CHAT_FEEDBACK = ["", "up", "down"] as const;
export type ChatFeedback = (typeof CHAT_FEEDBACK)[number];

/**
 * Staff triage of unanswered or disliked questions: "open" until someone has
 * fixed the site content / added a fixed answer ("done") or decided it needs
 * nothing ("ignored"). Set for all questions with the same `normalized` at once.
 */
export const CHAT_STATUSES = ["open", "done", "ignored"] as const;
export type ChatStatus = (typeof CHAT_STATUSES)[number];

/**
 * Questions are deleted automatically this many days after they were asked.
 * CHATBOT_RETENTION_DAYS (7-365), default 90: long enough to compare weeks,
 * see a festival through and find repeat questions, no longer than the report
 * needs. Changing it takes effect on the next backend start (syncRetention).
 */
export const RETENTION_DAYS = Math.min(Math.max(Math.round(Number(process.env.CHATBOT_RETENTION_DAYS) || 90), 7), 365);

export interface IChatQuestion {
  question: string;
  answer: string;
  /** false when the bot said it doesn't have that detail. */
  answered: boolean;
  /** How it was answered: by the AI, from the cache, small talk, or a fixed template. */
  source: ChatSource;
  /** The same question asked in different ways gets the same value. Set by the hook. */
  normalized: string;
  /** The site page the chat was opened on, e.g. "/submit-film". Never a full URL. */
  page: string;
  feedback: ChatFeedback;
  feedbackAt?: Date;
  status: ChatStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Hides email addresses and phone numbers, so personal details are never stored. */
export function redact(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\+?\d[\d\s()-]{7,}\d/g, "[phone]");
}

/** Lowercase, no punctuation, single spaces: "How do I submit my film?" and "how do i submit my film" match. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const chatQuestionSchema = new Schema<IChatQuestion>(
  {
    question: { type: String, required: true, trim: true, maxlength: 1000 },
    answer: { type: String, default: "", maxlength: 6000 },
    answered: { type: Boolean, required: true },
    source: { type: String, required: true, enum: CHAT_SOURCES },
    normalized: { type: String, index: true },
    page: { type: String, default: "", maxlength: 200 },
    feedback: { type: String, enum: CHAT_FEEDBACK, default: "" },
    feedbackAt: { type: Date },
    status: { type: String, enum: CHAT_STATUSES, default: "open" },
  },
  { timestamps: true },
);

// Runs before every save: clean the question and answer, work out `normalized`.
chatQuestionSchema.pre("validate", function () {
  if (this.question) {
    this.question = redact(this.question);
    this.normalized = normalize(this.question);
  }
  if (this.answer) this.answer = redact(this.answer);
});

// Doubles as the date index for the report and as the automatic clean-up:
// MongoDB deletes each document RETENTION_DAYS after its createdAt.
const RETENTION_SECONDS = RETENTION_DAYS * 24 * 60 * 60;
chatQuestionSchema.index({ createdAt: -1 }, { expireAfterSeconds: RETENTION_SECONDS });

const ChatQuestion = model<IChatQuestion>("ChatQuestion", chatQuestionSchema);

/**
 * MongoDB won't change an existing index's expiry by creating it again (the
 * attempt is rejected as a conflict), so when CHATBOT_RETENTION_DAYS changes,
 * this updates the live index in place (collMod) once the database connects.
 * A missing collection is fine: the index is then created with the right value.
 */
async function syncRetention() {
  try {
    const indexes = await ChatQuestion.collection.indexes();
    const ttl = indexes.find((i) => i.key?.createdAt === -1);
    if (ttl && ttl.expireAfterSeconds !== RETENTION_SECONDS) {
      await ChatQuestion.db.db!.command({
        collMod: ChatQuestion.collection.collectionName,
        index: { keyPattern: { createdAt: -1 }, expireAfterSeconds: RETENTION_SECONDS },
      });
      console.log(`Chatbot questions: retention set to ${RETENTION_DAYS} days.`);
    }
  } catch (error) {
    if ((error as { codeName?: string })?.codeName !== "NamespaceNotFound") {
      console.error("Chatbot questions: couldn't update the retention period:", error);
    }
  }
}
if (ChatQuestion.db.readyState === 1) void syncRetention();
else ChatQuestion.db.once("open", () => void syncRetention());

export default ChatQuestion;
