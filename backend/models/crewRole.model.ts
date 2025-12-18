import { Schema, model, Types } from "mongoose";

export interface ICrewRole {
  name: string;
  description?: string;
}

const crewRoleSchema = new Schema<ICrewRole>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100,
  },
  description: {
    type: String,
    trim: true,
    maxLength: 500,
  },
});

const CrewRole = model("CrewRole", crewRoleSchema);
export default CrewRole;
