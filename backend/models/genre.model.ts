import { Schema, model, Types } from "mongoose";

export interface IGenre {
  name: string;
  description?: string;
}

const genreSchema = new Schema<IGenre>({
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

const Genre = model("Genre", genreSchema);
export default Genre;
