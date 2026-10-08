import { Schema, model, Types } from "mongoose";

export type SubmissionStatus = "SUBMITTED" | "APPROVED" | "REJECTED";
export interface ISubmission {
  creatorId: Types.ObjectId;
  title: string;
  synopsis: string;
  releaseDate: Date;
  potraitImageUrl?: string;
  landscapeImageUrl?: string;
  assetPrefix?: string;
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
  trailerPassword?: string;
  promoClips?: Array<{ url: string; password?: string }>;
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
      representativeName?: string;
      representativeRelationship?: string;
      email?: string;
      contactPhone?: string;
      notes?: string;
      order?: number;
    }>;
    directors: Array<{
      fullName: string;
      role: string;
      imageUrl?: string;
      instagramUrl?: string;
      biography?: string;
      representativeName?: string;
      representativeRelationship?: string;
      email?: string;
      contactPhone?: string;
      notes?: string;
    }>;
    producers: Array<{
      fullName: string;
      role: string;
      imageUrl?: string;
      instagramUrl?: string;
      biography?: string;
      representativeName?: string;
      representativeRelationship?: string;
      email?: string;
      contactPhone?: string;
      notes?: string;
    }>;
    other: Array<{
      fullName: string;
      role: string;
      imageUrl?: string;
      instagramUrl?: string;
      biography?: string;
      representativeName?: string;
      representativeRelationship?: string;
      email?: string;
      contactPhone?: string;
      notes?: string;
    }>;
  };
  nominations?: Array<{
    awardCategoryId: Types.ObjectId;
    categoryName: string;
    wholeTeam: boolean;
    nominees: Array<{ group: CrewGroup; fullName: string; role: string }>;
  }>;
}

export type CrewGroup = "actors" | "directors" | "producers" | "other";

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
    // S3 folder holding every image for this submission (banners + crew
    // photos). Recorded so the whole set can be removed by prefix later
    // rather than by reconstructing ten individual keys. Empty on records
    // predating per-submission folders, and on hand-uploaded imports.
    assetPrefix: {
      type: String,
      default: "",
      trim: true,
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
    // Password for a protected trailer folder/file, as supplied by the
    // submitter. Staff-only, like contactEmail: it must stay out of every
    // public projection — see the explicit exclusion in getSubmission.
    trailerPassword: {
      type: String,
      default: "",
      trim: true,
    },
    // Short clips the submitter offers for social promotion, each a download
    // link plus the password for it when the folder is protected. The
    // passwords are staff-only on the same terms as trailerPassword — see
    // the exclusion in getSubmission.
    promoClips: {
      type: [
        {
          _id: false,
          url: { type: String, required: true, trim: true },
          password: { type: String, default: "", trim: true },
        },
      ],
      default: [],
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
            // Required on public submissions, but enforced in
            // createSubmissionPublic rather than here: records that predate
            // these fields would otherwise fail every staff save.
            representativeName: { type: String, default: "", trim: true },
            representativeRelationship: { type: String, default: "", trim: true },
            email: { type: String, default: "", trim: true },
            contactPhone: { type: String, default: "", trim: true },
            notes: { type: String, default: "", trim: true, maxLength: 1000 },
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
            representativeName: { type: String, default: "", trim: true },
            representativeRelationship: { type: String, default: "", trim: true },
            email: { type: String, default: "", trim: true },
            contactPhone: { type: String, default: "", trim: true },
            notes: { type: String, default: "", trim: true, maxLength: 1000 },
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
            representativeName: { type: String, default: "", trim: true },
            representativeRelationship: { type: String, default: "", trim: true },
            email: { type: String, default: "", trim: true },
            contactPhone: { type: String, default: "", trim: true },
            notes: { type: String, default: "", trim: true, maxLength: 1000 },
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
            representativeName: { type: String, default: "", trim: true },
            representativeRelationship: { type: String, default: "", trim: true },
            email: { type: String, default: "", trim: true },
            contactPhone: { type: String, default: "", trim: true },
            notes: { type: String, default: "", trim: true, maxLength: 1000 },
          },
        ],
        default: [],
      },
    },
    // The awards the submitter asked to be considered for. A request, not a
    // nomination: staff create the real ones in the `nominations` collection.
    // Nominees are name snapshots rather than crew subdocument ids because
    // the CMS crew editor saves crew as a whole object, which can mint new
    // ids and would orphan any reference to the old ones.
    nominations: {
      type: [
        {
          _id: false,
          awardCategoryId: {
            type: Schema.Types.ObjectId,
            ref: "AwardCategory",
            required: true,
          },
          // Kept beside the id so the request still reads correctly if the
          // category is later renamed or deleted.
          categoryName: { type: String, required: true, trim: true },
          wholeTeam: { type: Boolean, default: false },
          nominees: {
            type: [
              {
                _id: false,
                group: {
                  type: String,
                  enum: ["actors", "directors", "producers", "other"],
                  required: true,
                },
                fullName: { type: String, required: true, trim: true },
                role: { type: String, default: "", trim: true },
              },
            ],
            default: [],
          },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

const Submission = model("Submission", submissionSchema);
export default Submission;
