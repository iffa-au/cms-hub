import { Schema, model, Types } from "mongoose";

export interface IFilmEnquiry {
  name: string; // name of the person who is enquiring
  email: string;
  role: string; // role of the person who is enquiring (e.g. "producer", "director", "actor", "writer", "other")
  title: string;
  synopsis: string;
  productionHouse: string;
  distributor?: string;
  releaseDate: Date;
  contentType: Types.ObjectId;
  genreIds: Types.ObjectId[];
  country: Types.ObjectId;
  language: Types.ObjectId;
  trailerUrl: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const filmEnquirySchema = new Schema<IFilmEnquiry>({
  name: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, required: true },
  title: { type: String, required: true },
  synopsis: { type: String, required: true },
  productionHouse: { type: String, required: true },
  distributor: { type: String, required: false },
  releaseDate: { type: Date, required: true },
  contentType: { type: Types.ObjectId, ref: "ContentType", required: true },
  genreIds: [{ type: Types.ObjectId, ref: "Genre" }],
  country: { type: Types.ObjectId, ref: "Country", required: true },
  language: { type: Types.ObjectId, ref: "Language", required: true },
  trailerUrl: { type: String, required: true },
}, { timestamps: true });

const FilmEnquiry = model("FilmEnquiry", filmEnquirySchema);
export default FilmEnquiry;
