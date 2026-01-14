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
      trim: true,
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
    contentTypeId: {
      type: Schema.Types.ObjectId,
      ref: "ContentType",
      required: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    imdbUrl: {
      type: String,
      default: "",
    },
    trailerUrl: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const Submission = model("Submission", submissionSchema);
export default Submission;
