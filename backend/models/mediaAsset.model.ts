import { Schema, model } from "mongoose";

export interface IMediaAsset {
  title: string;
  type: string;
  s3Key: string;
  youtubeUrl: string;
}

const mediaAssetSchema = new Schema<IMediaAsset>({
  title: {
    type: String,
    required: true,
    unique: true,
  },
  type: {
    type: String,
    required: true,
  },
  s3Key: {
    type: String,
    required: true,
  },
  youtubeUrl: {
    type: String,
    required: true,
  },
}, {
  timestamps: true,
});

export const MediaAsset = model<IMediaAsset>("mediaAsset", mediaAssetSchema, "mediaAsset");
