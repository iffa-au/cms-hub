import { Schema, model, Types } from "mongoose";

export interface ICrewAssignment {
  submissionId: Types.ObjectId;
  crewMemberId: Types.ObjectId;
  crewRoleId: Types.ObjectId;
}

const crewAssignmentSchema = new Schema<ICrewAssignment>({
  submissionId: {
    type: Schema.Types.ObjectId,
    ref: "Submission",
    required: true,
  },
  crewMemberId: {
    type: Schema.Types.ObjectId,
    ref: "CrewMember",
    required: true,
  },
  crewRoleId: {
    type: Schema.Types.ObjectId,
    ref: "CrewRole",
    required: true,
  },
});

// Ensure one role per crew member per submission is unique
crewAssignmentSchema.index(
  { submissionId: 1, crewMemberId: 1, crewRoleId: 1 },
  { unique: true }
);

const CrewAssignment = model("CrewAssignment", crewAssignmentSchema);
export default CrewAssignment;
