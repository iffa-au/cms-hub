import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "./auth.middleware.js";

// After a successful staff write, tell the public site to drop its cached
// /events/[year]/{winners,nominations,submissions} pages (they are ISR, 10 min).
// Fire-and-forget: the call runs after the response is sent and any failure
// is only logged, so it can never fail or slow the CMS save.
//
// Skips GETs, failed requests (>= 400) and unauthenticated writes (the public
// submit-film POST creates a pending submission the site doesn't show).
//
// ponytail: refreshes every year on any write; send the year if that ever matters.
export function revalidateSiteOnWrite(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.method !== "GET") {
    res.on("finish", () => {
      if (res.statusCode < 400 && req.user) revalidateSite();
    });
  }
  next();
}

function revalidateSite() {
  const siteUrl = process.env.SITE_URL;
  const secret = process.env.SITE_REVALIDATE_SECRET;
  if (!siteUrl || !secret) return;

  try {
    fetch(`${siteUrl.replace(/\/$/, "")}/api/revalidate`, {
      method: "POST",
      headers: { "x-revalidate-secret": secret, "content-type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(5000),
    })
      .then((r) => {
        if (!r.ok) console.error(`Site revalidate failed: ${r.status}`);
      })
      .catch((err) => console.error("Site revalidate failed:", err?.message ?? err));
  } catch (err) {
    console.error("Site revalidate failed:", err);
  }
}
