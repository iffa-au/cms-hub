import e from "express";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import {
  createChatQuestion,
  deleteChatQuestion,
  getChatQuestionReport,
  getChatQuestions,
  requireChatbotKey,
  setChatQuestionFeedback,
  setChatQuestionStatus,
} from "../controllers/chatQuestion.controller.js";

const router = e.Router();
const admin = [requireAuth, requireRole("admin")];

// iffa-2026's chatbot server. Needs the shared CHATBOT_INSIGHTS_KEY, not a user login.
router.post("/", requireChatbotKey, createChatQuestion);
router.patch("/:id/feedback", requireChatbotKey, setChatQuestionFeedback);

// The CMS "Chatbot insights" page. Admins only.
router.get("/", ...admin, getChatQuestions); // paged list with each answer, or ?format=csv
router.get("/report", ...admin, getChatQuestionReport); // aggregated numbers
router.patch("/status", ...admin, setChatQuestionStatus); // done / ignored / open, by wording
router.delete("/:id", ...admin, deleteChatQuestion);

export default router;
