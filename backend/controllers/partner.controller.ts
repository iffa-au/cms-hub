import { Request, Response } from "express";
import Partner, { PARTNER_TIERS, type PartnerTier } from "../models/partner.model.js";
import { deleteUploadedObject } from "../libs/s3.js";

// Display order of the tiers themselves. Can't be done with a plain Mongo
// sort — alphabetically CULTURAL would come before PRESENTING, which inverts
// the intended hierarchy.
const TIER_RANK: Record<PartnerTier, number> = {
  PRESENTING: 0,
  CULTURAL: 1,
  SUPPORTING: 2,
};

const isPartnerTier = (value: unknown): value is PartnerTier =>
  typeof value === "string" && (PARTNER_TIERS as readonly string[]).includes(value);

const sortPartners = <T extends { tier: PartnerTier; order?: number; name: string }>(
  partners: T[],
): T[] =>
  [...partners].sort((a, b) => {
    const tierDiff = TIER_RANK[a.tier] - TIER_RANK[b.tier];
    if (tierDiff !== 0) return tierDiff;
    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name);
  });

/**
 * Public API: active partners for the Partner With Us page, ordered by tier
 * then by the position staff set within each tier.
 */
export const fetchPartners = async (_req: Request, res: Response) => {
  try {
    const partners = await Partner.find(
      { isActive: true },
      { name: 1, logoUrl: 1, websiteUrl: 1, tier: 1, order: 1 },
    ).lean();
    res.status(200).json({ success: true, data: sortPartners(partners as never) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Staff-only: includes inactive partners so they can be re-enabled.
export const listPartners = async (_req: Request, res: Response) => {
  try {
    const partners = await Partner.find({}).lean();
    res.status(200).json({ success: true, data: sortPartners(partners as never) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const createPartner = async (req: Request, res: Response) => {
  try {
    const { name, logoUrl, logoKey, websiteUrl, tier, order, isActive } = req.body || {};

    if (!String(name || "").trim()) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }
    if (!String(logoUrl || "").trim()) {
      return res.status(400).json({ success: false, message: "Logo is required" });
    }
    if (!isPartnerTier(tier)) {
      return res.status(400).json({
        success: false,
        message: `Tier must be one of: ${PARTNER_TIERS.join(", ")}`,
      });
    }

    const created = await Partner.create({
      name: String(name).trim(),
      logoUrl: String(logoUrl).trim(),
      logoKey: String(logoKey || "").trim(),
      websiteUrl: String(websiteUrl || "").trim(),
      tier,
      order: Number.isFinite(Number(order)) ? Number(order) : 0,
      isActive: isActive === undefined ? true : !!isActive,
    });

    res.status(201).json({ success: true, message: "Partner created", data: created });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updatePartner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, logoUrl, logoKey, websiteUrl, tier, order, isActive } = req.body || {};

    const existing = await Partner.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Partner not found" });
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ success: false, message: "Name cannot be empty" });
      }
      updates.name = String(name).trim();
    }
    if (logoUrl !== undefined) {
      if (!String(logoUrl).trim()) {
        return res.status(400).json({ success: false, message: "Logo cannot be empty" });
      }
      updates.logoUrl = String(logoUrl).trim();
    }
    if (logoKey !== undefined) updates.logoKey = String(logoKey || "").trim();
    if (websiteUrl !== undefined) updates.websiteUrl = String(websiteUrl || "").trim();
    if (tier !== undefined) {
      if (!isPartnerTier(tier)) {
        return res.status(400).json({
          success: false,
          message: `Tier must be one of: ${PARTNER_TIERS.join(", ")}`,
        });
      }
      updates.tier = tier;
    }
    if (order !== undefined && Number.isFinite(Number(order))) {
      updates.order = Number(order);
    }
    if (isActive !== undefined) updates.isActive = !!isActive;

    const updated = await Partner.findByIdAndUpdate(id, { $set: updates }, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Partner not found" });
    }

    // Logo was swapped for a different uploaded file — clean up the old one.
    // Deliberately after the successful write: a failed cleanup must never
    // roll back or block the edit the admin actually asked for.
    const previousKey = existing.logoKey?.trim();
    if (previousKey && updates.logoKey !== undefined && updates.logoKey !== previousKey) {
      await deleteUploadedObject(previousKey);
    }

    res.status(200).json({ success: true, message: "Partner updated", data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const deletePartner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await Partner.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Partner not found" });
    }

    // Only ever deletes an object this app uploaded itself: logoKey is empty
    // for logos that point at a repo path or an external URL, so those are
    // left untouched.
    const key = deleted.logoKey?.trim();
    if (key) await deleteUploadedObject(key);

    res.status(200).json({ success: true, message: "Partner deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
