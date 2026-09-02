import { Schema, model } from "mongoose";

/**
 * A podcast episode.
 *
 * The video itself lives on YouTube — YouTube is only the host. Every surface
 * on the public site embeds the player, so nothing here is allowed to be a
 * "go watch it over there" link: `youtubeVideoId` is what the site iframes,
 * and it is derived and validated server-side rather than trusted from the
 * CMS form, because a URL the parser cannot read produces a hero with a dead
 * player and no error anywhere.
 *
 * Thumbnails are deliberately optional. YouTube publishes one for every video
 * at a predictable URL, and for a podcast that image *is* the artwork — so the
 * default costs no upload, no S3 folder, and no cascade delete. `thumbnailUrl`
 * exists for the case where an editor wants different artwork on the IFFA
 * site than the one on YouTube.
 *
 * MONGOOSE TRAP (see AGENTS.md): a field declared only on the TypeScript
 * interface is silently dropped on save. Every field below appears in BOTH the
 * interface and the Schema object. When adding one, do the same and verify
 * with a real query.
 */

export interface IPodcast {
  /** URL segment on the public site: /podcast/<slug>. Unique. */
  slug: string;
  title: string;
  /** One or two sentences. Cards and the hero use this, never `description`. */
  excerpt?: string;
  /**
   * The full episode write-up. Plain text; blank lines separate paragraphs,
   * which is what the detail page renders from. Deliberately not rich text —
   * nothing in this CMS has an editor for it yet, and a half-supported HTML
   * field would end up rendered as escaped tags on the public page.
   */
  description?: string;
  /** Whatever the editor pasted, kept verbatim for the CMS to show back. */
  youtubeUrl: string;
  /** Parsed from youtubeUrl on every write. This is what the site embeds. */
  youtubeVideoId: string;
  /** Optional artwork override. Empty means "use the YouTube thumbnail". */
  thumbnailUrl?: string;
  category?: string;
  host?: string;
  guests: string[];
  /** Shown as "Episode 12" when set. 0 means the series is not numbered. */
  episodeNumber?: number;
  /** Display only — the player reports the real runtime. 0 hides the field. */
  durationMinutes?: number;
  /** Free text, e.g. "AIFFA 2026". Links nothing; it is a label. */
  relatedFestival?: string;
  /**
   * ISO date, e.g. "2026-09-02". The site sorts on this, so it decides the
   * order of the archive and, when nothing is flagged `isFeatured`, which
   * episode the page leads with. Deliberately not createdAt, which would make
   * back-filling an old episode silently promote it to the top of the page.
   */
  publishedAt: string;
  /** Lets staff draft an episode before it goes live. Public API returns published only. */
  isPublished?: boolean;
  /**
   * Marks the episode the public page leads with.
   *
   * Held on the episode rather than in a settings singleton because it is a
   * property of the episode an editor is already looking at, and because a
   * pointer in another document can outlive what it points at — a deleted
   * featured episode would leave the page reaching for a record that is gone.
   *
   * The controller keeps this exclusive: setting it on one episode clears it
   * everywhere else, so "the featured episode" is always exactly one or none.
   */
  isFeatured?: boolean;
}

const podcastSchema = new Schema<IPodcast>(
  {
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxLength: 140,
    },
    title: { type: String, required: true, trim: true, maxLength: 300 },
    excerpt: { type: String, default: "", trim: true, maxLength: 600 },
    description: { type: String, default: "", trim: true, maxLength: 20000 },
    youtubeUrl: { type: String, required: true, trim: true, maxLength: 500 },
    youtubeVideoId: { type: String, required: true, trim: true, maxLength: 32 },
    thumbnailUrl: { type: String, default: "", trim: true, maxLength: 500 },
    category: { type: String, default: "", trim: true, maxLength: 120 },
    host: { type: String, default: "", trim: true, maxLength: 200 },
    guests: { type: [String], default: [] },
    episodeNumber: { type: Number, default: 0 },
    durationMinutes: { type: Number, default: 0 },
    relatedFestival: { type: String, default: "", trim: true, maxLength: 200 },
    publishedAt: { type: String, required: true, trim: true },
    isPublished: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Every read — public list, hero pick, "more podcasts" — is newest-first on
// publishedAt. The _id tiebreaker keeps the order stable when two episodes
// share a publish date, which is what a same-day double release looks like.
podcastSchema.index({ publishedAt: -1, _id: -1 });

const Podcast = model("Podcast", podcastSchema);
export default Podcast;
