import { Schema, model, Types } from "mongoose";

export interface INomination {
  submissionId: Types.ObjectId;
  awardCategoryId: Types.ObjectId;
  year: number;
  isWinner: boolean;
  crewMemberId?: Types.ObjectId | null;
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
  crewMemberId: {
    type: Schema.Types.ObjectId,
    ref: "CrewMember",
    default: null,
  },
});

const Nomination = model("Nomination", nominationSchema);
export default Nomination;
