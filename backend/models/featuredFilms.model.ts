import { Schema, model, Types } from "mongoose";

/**
 * The homepage's "Featured Selection" row: an ordered, staff-curated list of
 * submissions.
 *
 * A singleton rather than flags on each submission (the way the submissions
 * carousel does it with isFeatured/featuredOrder). Saving the row replaces one
 * document, so a failed save can never leave half the old order and half the
 * new; and the per-slot editorial fields below belong to the slot, not to the
 * film — the same film could carry a different badge next year.
 *
 * Everything else the row shows (poster, synopsis, director, runtime, country,
 * trailer) is read live from the submission, so editing the film in the CMS
 * updates the homepage without touching this document.
 *
 * MONGOOSE TRAP (see AGENTS.md): a field declared only on the TypeScript
 * interface is silently dropped on save. Every field below appears in BOTH the
 * interface and the Schema object.
 */

export const MAX_FEATURED_FILMS = 6;

export interface IFeaturedFilmEntry {
  submissionId: Types.ObjectId;
  /** Label above the title, e.g. "Must Watch". Blank → "Official Selection". */
  badge: string;
  /**
   * The end of the title drawn in the accent colour, e.g. "The Revenge" for
   * "Dhurandhar The Revenge". Blank → the last word. Ignored by the site if
   * the title no longer ends with it.
   */
  titleAccent: string;
  /**
   * Short genre for the metadata grid. Blank → the film's first two genres.
   * Exists because some films carry eight genre tags.
   */
  genre: string;
}

export interface IFeaturedFilms {
  entries: IFeaturedFilmEntry[];
}

const entrySchema = new Schema<IFeaturedFilmEntry>(
  {
    submissionId: { type: Schema.Types.ObjectId, ref: "Submission", required: true },
    badge: { type: String, default: "", trim: true, maxLength: 40 },
    titleAccent: { type: String, default: "", trim: true, maxLength: 200 },
    genre: { type: String, default: "", trim: true, maxLength: 60 },
  },
  { _id: false },
);

const featuredFilmsSchema = new Schema<IFeaturedFilms>(
  {
    entries: {
      type: [entrySchema],
      default: [],
      validate: {
        validator: (entries: IFeaturedFilmEntry[]) => entries.length <= MAX_FEATURED_FILMS,
        message: `At most ${MAX_FEATURED_FILMS} featured films`,
      },
    },
  },
  { timestamps: true },
);

const FeaturedFilms = model("FeaturedFilms", featuredFilmsSchema);
export default FeaturedFilms;
