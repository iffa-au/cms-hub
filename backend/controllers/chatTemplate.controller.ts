import { z } from "zod";
import ChatTemplate from "../models/chatTemplate.model.js";

/*
  Fixed answers for the IFFA Assistant (see models/chatTemplate.model.ts).

  Website side (shared key, requireChatbotKey in the router):
    GET    /active      what the chatbot needs: [{ id, matches, answer }] of active answers

  Admin side (requireRole("admin")), the CMS "Fixed answers" tab:
    GET    /            all fixed answers, newest first
    POST   /            create
    PATCH  /:id         edit (any of question, phrasings, answer, active)
    DELETE /:id
*/

const isObjectId = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{24}$/i.test(v);

const templateBody = z.object({
  question: z.string().trim().min(3, "Question needs at least 3 characters").max(300),
  phrasings: z.array(z.string().trim().max(300)).max(20).optional().default([]),
  answer: z.string().trim().min(3, "Answer needs at least 3 characters").max(3000),
  active: z.boolean().optional().default(true),
});

const firstIssue = (error: z.ZodError) => error.issues[0]?.message || "Invalid fixed answer";

export const getActiveChatTemplates = async (req, res) => {
  try {
    const items = await ChatTemplate.find({ active: true }).select("matches answer").lean();
    res.status(200).json({
      success: true,
      data: items.map((t) => ({ id: String(t._id), matches: t.matches, answer: t.answer })),
    });
  } catch (error) {
    console.error("Failed to load active fixed answers:", error);
    res.status(500).json({ success: false, message: "Failed to load fixed answers" });
  }
};

export const getChatTemplates = async (req, res) => {
  try {
    const items = await ChatTemplate.find().sort({ updatedAt: -1 }).lean();
    res.status(200).json({ success: true, message: "Fixed answers fetched successfully", data: items });
  } catch (error) {
    console.error("Failed to list fixed answers:", error);
    res.status(500).json({ success: false, message: "Failed to list fixed answers" });
  }
};

export const createChatTemplate = async (req, res) => {
  const parsed = templateBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: firstIssue(parsed.error) });
  try {
    const doc = await ChatTemplate.create(parsed.data);
    res.status(201).json({ success: true, message: "Fixed answer created", data: doc });
  } catch (error) {
    console.error("Failed to create fixed answer:", error);
    res.status(500).json({ success: false, message: "Failed to create fixed answer" });
  }
};

export const updateChatTemplate = async (req, res) => {
  if (!isObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id" });
  const parsed = templateBody.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: firstIssue(parsed.error) });
  try {
    const doc = await ChatTemplate.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Fixed answer not found" });
    // Only the fields that were sent; the partial schema fills no defaults for missing ones.
    for (const key of ["question", "phrasings", "answer", "active"] as const) {
      if (key in req.body && parsed.data[key] !== undefined) doc.set(key, parsed.data[key]);
    }
    await doc.save(); // save (not findByIdAndUpdate) so the hook recomputes `matches`
    res.status(200).json({ success: true, message: "Fixed answer updated", data: doc });
  } catch (error) {
    console.error("Failed to update fixed answer:", error);
    res.status(500).json({ success: false, message: "Failed to update fixed answer" });
  }
};

export const deleteChatTemplate = async (req, res) => {
  if (!isObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id" });
  try {
    const deleted = await ChatTemplate.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Fixed answer not found" });
    res.status(200).json({ success: true, message: "Fixed answer deleted" });
  } catch (error) {
    console.error("Failed to delete fixed answer:", error);
    res.status(500).json({ success: false, message: "Failed to delete fixed answer" });
  }
};
