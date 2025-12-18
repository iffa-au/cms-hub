import { Schema, model, Types } from "mongoose";

export interface IContentType {
  name: string;
  description?: string;
}

const contentTypeSchema = new Schema<IContentType>({
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

const ContentType = model("ContentType", contentTypeSchema);
export default ContentType;
