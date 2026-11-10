import e from "express";
import {
  createTalentLabApplication,
  createTalentLabRegistration,
  listTalentLabApplications,
  getTalentLabApplication,
  updateTalentLabApplication,
  deleteTalentLabApplication,
  listTalentLabRegistrations,
  getTalentLabRegistration,
  deleteTalentLabRegistration,
} from "../controllers/talentLabForms.controller.js";
import { contentHandlers, KINDS } from "../controllers/talentLabContent.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = e.Router();
const staff = [requireAuth, requireRole("admin", "staff")] as const;

// Public: the site's /talent-lab/apply and /talent-lab/register forms.
router.post("/applications", createTalentLabApplication);
router.post("/registrations", createTalentLabRegistration);

// Staff: the CMS inbox. Applications hold sensitive answers — never public.
router.get("/applications", ...staff, listTalentLabApplications);
router.get("/applications/:id", ...staff, getTalentLabApplication);
router.patch("/applications/:id", ...staff, updateTalentLabApplication);
router.delete("/applications/:id", ...staff, deleteTalentLabApplication);

router.get("/registrations", ...staff, listTalentLabRegistrations);
router.get("/registrations/:id", ...staff, getTalentLabRegistration);
router.delete("/registrations/:id", ...staff, deleteTalentLabRegistration);

// Events, Opportunities, Mentors: public read, staff edit. "/manage" and
// "/order" are registered before "/:id" so they are never read as an id.
for (const [path, kind] of Object.entries(KINDS)) {
  const h = contentHandlers(kind);
  router.get(`/${path}`, h.fetchPublic);
  router.get(`/${path}/manage`, ...staff, h.listManage);
  router.get(`/${path}/manage/:id`, ...staff, h.getManage);
  router.post(`/${path}`, ...staff, h.create);
  router.put(`/${path}/order`, ...staff, h.reorder);
  router.put(`/${path}/:id`, ...staff, h.update);
  router.delete(`/${path}/:id`, ...staff, h.remove);
}

export default router;
