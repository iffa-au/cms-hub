import { Schema, model } from "mongoose";
import { normalize } from "./chatQuestion.model.js";

/**
 * A fixed answer for the IFFA Assistant, written or approved by staff in the
 * CMS ("Chatbot insights" → "Fixed answers").
 *
 * When a visitor's question matches one of these (at any point in a chat), the chatbot replies
 * with `answer` straight away: no AI call, no quota, always the same approved
 * wording. Matching is on the normalized question (lowercase, no punctuation),
 * so "How do I submit my film?" and "how do i submit my film" both match; add
 * other wordings to `phrasings`.
 *
 * `matches` is worked out by the hook from `question` + `phrasings`; the
 * website only reads `matches` and `answer` (GET /chatbot-templates/active).
 *
 * Remember the Mongoose trap (AGENTS.md): a field that is only in the
 * interface is silently dropped. Add new fields to both.
 */

export interface IChatTemplate {
  question: string;
  phrasings: string[];
  answer: string;
  active: boolean;
  matches: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

const chatTemplateSchema = new Schema<IChatTemplate>(
  {
    question: { type: String, required: true, trim: true, maxlength: 300 },
    phrasings: { type: [String], default: [] },
    answer: { type: String, required: true, trim: true, maxlength: 3000 },
    active: { type: Boolean, default: true },
    matches: { type: [String], default: [], index: true },
  },
  { timestamps: true },
);

chatTemplateSchema.pre("validate", function () {
  this.phrasings = [...new Set((this.phrasings ?? []).map((p) => p.trim()).filter(Boolean))].slice(0, 20);
  this.matches = [...new Set([this.question, ...this.phrasings].map(normalize).filter(Boolean))];
});

const ChatTemplate = model<IChatTemplate>("ChatTemplate", chatTemplateSchema);
export default ChatTemplate;
