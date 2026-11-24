import e from "express";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { requireChatbotKey } from "../controllers/chatQuestion.controller.js";
import {
  createChatTemplate,
  deleteChatTemplate,
  getActiveChatTemplates,
  getChatTemplates,
  updateChatTemplate,
} from "../controllers/chatTemplate.controller.js";

const router = e.Router();
const admin = [requireAuth, requireRole("admin")];

// iffa-2026's chatbot server: the active fixed answers. Needs the shared key.
router.get("/active", requireChatbotKey, getActiveChatTemplates);

// The CMS "Fixed answers" tab. Admins only.
router.get("/", ...admin, getChatTemplates);
router.post("/", ...admin, createChatTemplate);
router.patch("/:id", ...admin, updateChatTemplate);
router.delete("/:id", ...admin, deleteChatTemplate);

export default router;
