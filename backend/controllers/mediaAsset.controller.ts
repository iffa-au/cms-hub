import { Request, Response } from "express";
import { MediaAsset } from "../models/mediaAsset.model.js";

export const getMediaAssets = async (req: Request, res: Response) => {
  try {
    const assets = await MediaAsset.find();
    res.status(200).json(assets);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getMediaAssetByTitle = async (req: Request, res: Response) => {
  try {
    const { title } = req.params;
    const asset = await MediaAsset.findOne({ title: title });
    
    if (!asset) {
      return res.status(404).json({ message: "Media asset not found" });
    }
    
    res.status(200).json(asset);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createMediaAsset = async (req: Request, res: Response) => {
  try {
    const { title, type, s3Key } = req.body;
    const newAsset = new MediaAsset({ title, type, s3Key });
    await newAsset.save();
    res.status(201).json(newAsset);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
