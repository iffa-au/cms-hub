import { Schema, model, Types } from "mongoose";

export interface ICrewMember {
  name: string;
  biography?: string;
  profilePicture?: string;
  instagramUrl?: string;
  description?: string;
}

const CrewMemberSchema = new Schema<ICrewMember>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100,
  },
  biography: {
    type: String,
    trim: true,
    maxLength: 2000,
  },
  profilePicture: {
    type: String,
    default: "",
  },
  instagramUrl: {
    type: String,
    default: "",
  },
  description: {
    type: String,
    trim: true,
    maxLength: 500,
  },
});

const CrewMember = model("CrewMember", CrewMemberSchema);
export default CrewMember;
