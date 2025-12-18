import { Schema, model, Types } from "mongoose";

export interface INomination {
  submissionId: Types.ObjectId;
  awardCategoryId: Types.ObjectId;
  year: number;
  isWinner: boolean;
}

const nominationSchema = new Schema<INomination>({
  submissionId: {
    type: Schema.Types.ObjectId,
    ref: "Submission",
    required: true,
  },
  awardCategoryId: {
    type: Schema.Types.ObjectId,
    ref: "AwardCategory",
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  isWinner: {
    type: Boolean,
    default: false,
  },
});

const Nomination = model("Nomination", nominationSchema);
export default Nomination;
