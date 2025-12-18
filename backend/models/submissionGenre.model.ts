import { Schema, model, Types } from "mongoose";

export interface ISubmissionGenre {
  submissionId: Types.ObjectId;
  genreId: Types.ObjectId;
}

const submissionGenreSchema = new Schema<ISubmissionGenre>({
  submissionId: {
    type: Schema.Types.ObjectId,
    ref: "Submission",
    required: true,
  },
  genreId: {
    type: Schema.Types.ObjectId,
    ref: "Genre",
    required: true,
  },
});

const SubmissionGenre = model("SubmissionGenre", submissionGenreSchema);
export default SubmissionGenre;
