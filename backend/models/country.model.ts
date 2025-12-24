import { Schema, model, Types } from "mongoose";

export interface ICountry {
  name: string;
  description?: string;
}

const countrySchema = new Schema<ICountry>({
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

const Country = model("Country", countrySchema);
export default Country;
