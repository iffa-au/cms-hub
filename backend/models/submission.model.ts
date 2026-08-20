import { Schema, model, Types } from "mongoose";

export type SubmissionStatus = "SUBMITTED" | "APPROVED" | "REJECTED";
export interface ISubmission {
  creatorId: Types.ObjectId;
  title: string;
  synopsis: string;
  releaseDate: Date;
  potraitImageUrl?: string;
  landscapeImageUrl?: string;
  isFeatured?: boolean;
  // 1-5, only set while isFeatured is true — controls slide order in the
  // public submissions-page hero carousel. Cleared when a film is removed
  // from the carousel.
  featuredOrder?: number;
  status: SubmissionStatus;
  languageId: Types.ObjectId;
  countryId: Types.ObjectId;
  contentTypeId: Types.ObjectId;
  releaseCountryIds?: Types.ObjectId[];
  watchFormats?: string[];
  notes?: string;
  imdbUrl?: string;
  trailerUrl?: string;
  releaseLinkUrl?: string;
  contactEmail?: string;
  genreIds: Types.ObjectId[];
  productionHouse?: String; // production house name (e.g. "Universal Pictures")
  distributor?: String; // distributor name (e.g. "Netflix")
  durationHours?: number; // runtime, whole hours (e.g. 1)
  durationMinutes?: number; // runtime, minutes 0-59 (e.g. 42)
  // User-proposed crew grouped by category (public form payload)
  submission_year?: number; // Optional field to capture the year of submission for nomination purposes
  crew?: {
    actors: Array<{
      fullName: string;
      role: string;
      imageUrl?: string;
      biography?: string;
      instagramUrl?: string;
      email?: string;
      order?: number;
    }>;
    directors: Array<{
      fullName: string;
      role: string;
      imageUrl?: string;
      instagramUrl?: string;
      biography?: string;
      email?: string;
    }>;
    producers: Array<{
      fullName: string;
      role: string;
      imageUrl?: string;
      instagramUrl?: string;
      biography?: string;
      email?: string;
    }>;
    other: Array<{
      fullName: string;
      role: string;
      imageUrl?: string;
      instagramUrl?: string;
      biography?: string;
      email?: string;
    }>;
  };
}

const submissionSchema = new Schema<ISubmission>(
  {
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxLength: 200,
    },
    synopsis: {
      type: String,
    },
    releaseDate: {
      type: Date,
      required: true,
    },
    potraitImageUrl: {
      type: String,
      default: "",
    },
    landscapeImageUrl: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["SUBMITTED", "APPROVED", "REJECTED"],
      default: "SUBMITTED",
    },
    languageId: {
      type: Schema.Types.ObjectId,
      ref: "Language",
      required: true,
    },
    countryId: {
      type: Schema.Types.ObjectId,
      ref: "Country",
      required: true,
    },
    releaseCountryIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Country" }],
      default: [],
    },
    watchFormats: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      default: "",
      maxlength: 1000,
    },
    genreIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Genre" }],
      default: [],
    },
    contentTypeId: {
      type: Schema.Types.ObjectId,
      ref: "ContentType",
      required: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    featuredOrder: {
      type: Number,
      min: 1,
      max: 5,
    },
    productionHouse: {
      type: String,
      default: "",
    },
    distributor: {
      type: String,
      default: "",
    },
    imdbUrl: {
      type: String,
      default: "",
    },
    trailerUrl: {
      type: String,
      default: "",
    },
    releaseLinkUrl: {
      type: String,
      default: "",
    },
    // Not shown on the public site — only surfaced to staff via the
    // review queue and the /:id/overview endpoint (which requires auth).
    contactEmail: {
      type: String,
      default: "",
      trim: true,
    },
    durationHours: {
      type: Number,
      min: 0,
      max: 10,
    },
    durationMinutes: {
      type: Number,
      min: 0,
      max: 59,
    },
    // Declared in the ISubmission interface for a long time, but never
    // actually added here — Mongoose silently drops any field passed to
    // .create()/.save() that isn't a real schema path, so every fresh
    // submission has been created without it despite the controller code
    // setting it. findByIdAndUpdate's $set isn't filtered the same way,
    // which is why manually editing a submission via the CMS edit page has
    // been the only way this field ever actually got persisted.
    submission_year: {
      type: Number,
    },
    crew: {
      actors: {
        type: [
          {
            fullName: {
              type: String,
              required: true,
              trim: true,
              maxLength: 120,
            },
            role: { type: String, default: "", trim: true, maxLength: 120 },
            imageUrl: { type: String, default: "", trim: true },
            biography: {
              type: String,
              default: "",
              trim: true,
            },
            instagramUrl: { type: String, default: "", trim: true },
            email: { type: String, default: "", trim: true },
          },
        ],
        default: [],
      },
      directors: {
        type: [
          {
            fullName: {
              type: String,
              required: true,
              trim: true,
              maxLength: 120,
            },
            role: { type: String, default: "", trim: true, maxLength: 120 },
            imageUrl: { type: String, default: "", trim: true },
            instagramUrl: { type: String, default: "", trim: true },
            biography: {
              type: String,
              default: "",
              trim: true,
            },
            email: { type: String, default: "", trim: true },
          },
        ],
        default: [],
      },
      producers: {
        type: [
          {
            fullName: {
              type: String,
              required: true,
              trim: true,
              maxLength: 120,
            },
            role: { type: String, default: "", trim: true, maxLength: 120 },
            imageUrl: { type: String, default: "", trim: true },
            instagramUrl: { type: String, default: "", trim: true },
            biography: {
              type: String,
              default: "",
              trim: true,
            },
            email: { type: String, default: "", trim: true },
          },
        ],
        default: [],
      },
      other: {
        type: [
          {
            fullName: {
              type: String,
              required: true,
              trim: true,
              maxLength: 120,
            },
            role: { type: String, default: "", trim: true, maxLength: 120 },
            imageUrl: { type: String, default: "", trim: true },
            instagramUrl: { type: String, default: "", trim: true },
            biography: {
              type: String,
              default: "",
              trim: true,
            },
            email: { type: String, default: "", trim: true },
          },
        ],
        default: [],
      },
    },
  },
  { timestamps: true },
);

const Submission = model("Submission", submissionSchema);
export default Submission;
