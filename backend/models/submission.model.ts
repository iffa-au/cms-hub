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
  status: SubmissionStatus;
  languageId: Types.ObjectId;
  countryId: Types.ObjectId;
  contentTypeId: Types.ObjectId;
  imdbUrl?: string;
  trailerUrl?: string;
  genreIds: Types.ObjectId[];
  productionHouse?: String; // production house name (e.g. "Universal Pictures")
  distributor?: String; // distributor name (e.g. "Netflix")
  // User-proposed crew grouped by category (public form payload)
  crew?: {
    actors: Array<{
      fullName: string;
      role: string;
      imageUrl?: string;
      biography?: string;
      instagramUrl?: string;
      order?: number;
    }>;
    directors: Array<{
      fullName: string;
      role: string;
      imageUrl?: string;
      instagramUrl?: string;
      biography?: string;
    }>;
    producers: Array<{
      fullName: string;
      role: string;
      imageUrl?: string;
      instagramUrl?: string;
      biography?: string;
    }>;
    other: Array<{
      fullName: string;
      role: string;
      imageUrl?: string;
      instagramUrl?: string;
      biography?: string;
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

      maxLength: 2000,
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
              maxLength: 2000,
            },
            instagramUrl: { type: String, default: "", trim: true },
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
              maxLength: 2000,
            },
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
              maxLength: 2000,
            },
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
              maxLength: 2000,
            },
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
