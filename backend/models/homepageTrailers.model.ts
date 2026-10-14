import { Schema, model, Types } from "mongoose";

/**
 * The homepage trailer slots: an ordered, staff-curated list of videos.
 *
 * A singleton, like FeaturedFilms: reorder, add, edit and delete are one
 * write, so a failed save can never leave half an old order behind. Array
 * position is homepage order; the site fills its five fixed slots with the
 * first five entries that are not hidden.
 *
 * `videoKey` is set only for files cms-hub uploaded itself. The trailers that
 * predate this page were transcoded to HLS by hand and imported with an empty
 * key — which is what keeps cleanup from ever deleting them (the partner
 * `logoKey` rule).
 *
 * `singleton` exists only to carry a unique index, so two concurrent first
 * saves cannot create two documents.
 *
 * MONGOOSE TRAP (see AGENTS.md): every field below appears in BOTH the
 * interface and the Schema object.
 */

export const MAX_HOMEPAGE_TRAILERS = 10;
export const MAX_VISIBLE_TRAILERS = 5;

export interface IHomepageTrailerEntry {
  _id?: Types.ObjectId;
  title: string;
  /** CloudFront URL the site plays: an .mp4 for uploads, an .m3u8 for imports. */
  videoUrl: string;
  /** S3 key backing videoUrl, only for CMS uploads. Empty = never ours to delete. */
  videoKey: string;
  /** "Watch Trailer" button. Empty hides it. */
  youtubeUrl: string;
  /** "Learn More" button beside the title. Empty hides it. */
  learnMoreUrl: string;
  /** Kept in the list (and its file kept) but given no slot. */
  isHidden: boolean;
}

export interface IHomepageTrailers {
  singleton: string;
  entries: IHomepageTrailerEntry[];
  createdAt?: Date;
  updatedAt?: Date;
}

const entrySchema = new Schema<IHomepageTrailerEntry>(
  {
    title: { type: String, required: true, trim: true, maxLength: 120 },
    videoUrl: { type: String, required: true, trim: true },
    videoKey: { type: String, default: "", trim: true },
    youtubeUrl: { type: String, default: "", trim: true, maxLength: 500 },
    learnMoreUrl: { type: String, default: "", trim: true, maxLength: 500 },
    isHidden: { type: Boolean, default: false },
  },
  { _id: true },
);

const homepageTrailersSchema = new Schema<IHomepageTrailers>(
  {
    singleton: { type: String, default: "homepage", unique: true, immutable: true },
    entries: {
      type: [entrySchema],
      default: [],
      validate: {
        validator: (entries: IHomepageTrailerEntry[]) =>
          entries.length <= MAX_HOMEPAGE_TRAILERS,
        message: `At most ${MAX_HOMEPAGE_TRAILERS} homepage trailers`,
      },
    },
  },
  { timestamps: true },
);

const HomepageTrailers = model("HomepageTrailers", homepageTrailersSchema);
export default HomepageTrailers;
