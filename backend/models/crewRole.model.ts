import { Schema, model } from "mongoose";

export interface ICrewRole {
  name: string;
  description?: string;
}

const crewRoleSchema = new Schema<ICrewRole>({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    maxLength: 500,
    trim: true,
  },
});

const CrewRole = model("CrewRole", crewRoleSchema);
export default CrewRole;
