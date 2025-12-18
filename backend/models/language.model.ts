import { Schema, model, Types } from "mongoose";

export interface ILanguage {
  name: string;
  description?: string;
}

const languageSchema = new Schema<ILanguage>({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    maxLength: 500,
    trim: true,
  },
});

const Language = model("Language", languageSchema);
export default Language;
