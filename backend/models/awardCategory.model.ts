import { Schema, model, Types } from "mongoose";

export interface IAwardCategory {
  name: string;
  description?: string;
}

const awardCategorySchema = new Schema<IAwardCategory>({
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

const AwardCategory = model("AwardCategory", awardCategorySchema);
export default AwardCategory;
