/**
 * Reads @iffaawards' own Instagram media through Meta's Instagram API
 * (Instagram Login, `instagram_business_basic`).
 *
 * Why this exists: an Instagram embed always draws "View more on Instagram"
 * over a reel and never autoplays, and a website cannot change anything inside
 * that iframe. For media the connected account owns, the API returns
 * `media_url` — the video file itself — which we copy into our own S3 bucket
 * and play in a plain <video>. See submission.controller importSubmissionTrailer.
 *
 * Limits, from Meta's IG Media reference:
 * - `media_url` is omitted for video with copyrighted or licensed audio
 *   (including Instagram's audio library) or flagged for copyright, even on
 *   the owner's own media. Those keep playing through the embed.
 * - Only the connected account's media is listed. A reel posted by someone
 *   else — including a collab where IFFA is not the owner — is not found.
 * - `media_url` is a temporary CDN link, so it is copied, never stored.
 *
 * Two ways to connect, both read from env (never log the token):
 * - Unified login (what Meta gives new apps): a system-user token from the
 *   iffaawards business portfolio, which never expires, plus IG_USER_ID, the
 *   Instagram account's ID shown in Business Settings → Accounts → Instagram
 *   accounts. Read through graph.facebook.com/{IG_USER_ID}/media with
 *   `instagram_basic`.
 * - Instagram login (older apps): a 60-day Instagram user token, read through
 *   graph.instagram.com/me/media. Used when IG_USER_ID is not set.
 */

const API_VERSION = "v23.0";

/** The media listing URL for whichever connection the env describes. */
function mediaEndpoint(): string {
  const igUserId = process.env.IG_USER_ID?.trim();
  if (igUserId) {
    if (!/^\d+$/.test(igUserId)) {
      throw new InstagramConfigError("IG_USER_ID must be the numeric Instagram account ID.");
    }
    return `https://graph.facebook.com/${API_VERSION}/${igUserId}/media`;
  }
  return `https://graph.instagram.com/${API_VERSION}/me/media`;
}
const PAGE_SIZE = 100;
/** Meta returns at most the newest 10K media; stop well before a runaway loop. */
const MAX_PAGES = 100;
const CACHE_TTL_MS = 10 * 60 * 1000;

export class InstagramConfigError extends Error {}

/** Shown to staff as-is, so every message says what to do next. */
export class InstagramMediaError extends Error {
  constructor(
    message: string,
    readonly reason: "not-instagram" | "not-own-media" | "no-video-file" | "token",
  ) {
    super(message);
  }
}

export type OwnMedia = {
  id: string;
  shortcode: string;
  mediaType: string;
  mediaUrl?: string;
  permalink?: string;
};

/** Instagram shortcodes: letters, digits, `_` and `-`. Same rule as the site. */
const SHORTCODE = /^[\w-]{5,}$/;

/**
 * Staff sometimes paste Instagram's whole "Copy embed code" snippet instead of
 * the link. Pull the permalink back out, as the public site does.
 */
function linkFrom(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("<")) return trimmed;
  const match =
    trimmed.match(/data-instgrm-permalink="([^"]+)"/) ??
    trimmed.match(/\b(?:src|href)="(https?:\/\/[^"]+)"/);
  return match ? match[1].replace(/&amp;/g, "&") : trimmed;
}

/**
 * The shortcode of an Instagram post, reel or IGTV link, or null when the
 * value is not one. `/p/`, `/reel/`, `/reels/` and `/tv/` all share the same
 * shortcode space, and the API reports it without the kind.
 */
export function instagramShortcode(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(linkFrom(value));
    if (!/(^|\.)instagram\.com$/.test(url.hostname)) return null;
    const segments = url.pathname.split("/").filter(Boolean);
    // Optionally behind a username: /iffaawards/reel/<code>/
    const at = segments.findIndex((s) => ["p", "reel", "reels", "tv"].includes(s));
    const code = at === -1 ? undefined : segments[at + 1];
    return code && SHORTCODE.test(code) ? code : null;
  } catch {
    return null;
  }
}

function token(): string {
  const value = process.env.IG_ACCESS_TOKEN?.trim();
  if (!value) {
    throw new InstagramConfigError(
      "IG_ACCESS_TOKEN is not set on this server, so Instagram trailers cannot be copied. " +
        "Add the @iffaawards token (and IG_USER_ID) to the backend's environment.",
    );
  }
  return value;
}

type GraphPage = {
  data?: Array<{
    id: string;
    shortcode?: string;
    media_type?: string;
    media_url?: string;
    permalink?: string;
  }>;
  paging?: { next?: string };
  error?: { message?: string; code?: number; type?: string };
};

async function getPage(url: string): Promise<GraphPage> {
  const res = await fetch(url);
  const body = (await res.json().catch(() => ({}))) as GraphPage;
  if (!res.ok || body.error) {
    // 190 is Meta's "invalid or expired access token".
    if (body.error?.code === 190 || res.status === 401) {
      throw new InstagramMediaError(
        "The Instagram connection was refused (token expired or revoked). Generate a new token " +
          "for @iffaawards and update IG_ACCESS_TOKEN on the server.",
        "token",
      );
    }
    throw new Error(
      `Instagram API ${res.status}: ${body.error?.message ?? "unexpected response"}`,
    );
  }
  return body;
}

let cache: { at: number; media: OwnMedia[] } | null = null;

/**
 * Every media item on the connected account, newest first. Cached for ten
 * minutes: one CMS save checks one shortcode, and a backfill checks many.
 */
export async function listOwnMedia(): Promise<OwnMedia[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.media;

  const fields = "id,shortcode,media_type,media_url,permalink";
  const params = new URLSearchParams({
    fields,
    limit: String(PAGE_SIZE),
    access_token: token(),
  });
  let next: string | undefined = `${mediaEndpoint()}?${params}`;
  const media: OwnMedia[] = [];

  for (let page = 0; next && page < MAX_PAGES; page += 1) {
    const body: GraphPage = await getPage(next);
    for (const item of body.data ?? []) {
      if (!item.shortcode) continue;
      media.push({
        id: item.id,
        shortcode: item.shortcode,
        mediaType: item.media_type ?? "",
        mediaUrl: item.media_url,
        permalink: item.permalink,
      });
    }
    next = body.paging?.next;
  }

  cache = { at: Date.now(), media };
  return media;
}

/**
 * The downloadable video file for one of the account's own reels or videos.
 * Throws InstagramMediaError with a staff-readable message otherwise.
 */
export async function findOwnVideo(trailerUrl: unknown): Promise<OwnMedia & { mediaUrl: string }> {
  const shortcode = instagramShortcode(trailerUrl);
  if (!shortcode) {
    throw new InstagramMediaError("The trailer link is not an Instagram post or reel.", "not-instagram");
  }

  const match = (await listOwnMedia()).find((m) => m.shortcode === shortcode);
  if (!match) {
    throw new InstagramMediaError(
      "This reel is not on the @iffaawards account (it may belong to the film's own account), " +
        "so it can only play through Instagram's embed.",
      "not-own-media",
    );
  }
  if (match.mediaType !== "VIDEO" || !match.mediaUrl) {
    throw new InstagramMediaError(
      match.mediaType === "VIDEO"
        ? "Instagram won't release this video file, usually because it uses licensed music. " +
            "It will keep playing through Instagram's embed."
        : "This Instagram post is not a video.",
      "no-video-file",
    );
  }
  return { ...match, mediaUrl: match.mediaUrl };
}
