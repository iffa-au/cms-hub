import { Types } from "mongoose";
import FilmEnquiry from "../models/filmEnquiry.model.js";

const requiredRefFields = ["contentType", "country", "language"] as const;

function isValidObjectId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Types.ObjectId.isValid(value)
  );
}

export const getFilmEnquiries = async (req, res) => {
  try {
    const items = await FilmEnquiry.find()
      .sort({ createdAt: -1 })
      .populate("contentType genreIds country language");
    res.status(200).json({
      success: true,
      message: "Film enquiries fetched successfully",
      data: items,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getFilmEnquiryById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await FilmEnquiry.findById(id).populate(
      "contentType genreIds country language",
    );
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Film enquiry not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Film enquiry fetched successfully",
      data: item,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createFilmEnquiryPublic = async (req, res) => {
  try {
    const {
      name,
      email,
      role,
      title,
      synopsis,
      productionHouse,
      distributor,
      releaseDate,
      trailerUrl,
      contentType,
      genreIds,
      country,
      language,
    } = req.body || {};

    const requiredStrings = [
      "name",
      "email",
      "role",
      "title",
      "synopsis",
      "productionHouse",
      "trailerUrl",
    ] as const;
    for (const key of requiredStrings) {
      const value = req.body[key];
      if (
        value === undefined ||
        value === null ||
        String(value).trim() === ""
      ) {
        return res.status(400).json({
          success: false,
          message: `Missing or empty required field: ${key}`,
        });
      }
    }

    if (!releaseDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: releaseDate",
      });
    }
    const releaseDateObj = new Date(releaseDate);
    if (Number.isNaN(releaseDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid releaseDate",
      });
    }

    for (const key of requiredRefFields) {
      const value = req.body[key];
      if (!isValidObjectId(value)) {
        return res.status(400).json({
          success: false,
          message: `Missing or invalid ${key} (must be a valid ID)`,
        });
      }
    }

    const providedGenreIds: string[] = Array.isArray(genreIds)
      ? [...new Set(genreIds.filter((g) => isValidObjectId(g)))]
      : [];
    if (providedGenreIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one genre is required (genreIds[] array)",
      });
    }

    const filmEnquiry = await FilmEnquiry.create({
      name: String(name).trim(),
      email: String(email).trim(),
      role: String(role).trim(),
      title: String(title).trim(),
      synopsis: String(synopsis).trim(),
      productionHouse: String(productionHouse).trim(),
      distributor:
        distributor !== undefined && distributor !== null
          ? String(distributor).trim()
          : "",
      releaseDate: releaseDateObj,
      trailerUrl: String(trailerUrl).trim(),
      contentType,
      genreIds: providedGenreIds,
      country,
      language,
    });
    res.status(201).json({
      success: true,
      message: "Film enquiry created successfully",
      data: filmEnquiry,
    });
  } catch (error: any) {
    if (error?.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message || "Validation failed",
      });
    }
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteFilmEnquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await FilmEnquiry.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Film enquiry not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Film enquiry deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateFilmEnquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const updateFields: Record<string, unknown> = {};
    const allowed = [
      "name",
      "email",
      "role",
      "title",
      "synopsis",
      "productionHouse",
      "distributor",
      "releaseDate",
      "trailerUrl",
      "contentType",
      "genreIds",
      "country",
      "language",
    ] as const;
    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === "releaseDate") {
          const d = new Date(body[key]);
          if (Number.isNaN(d.getTime())) {
            return res.status(400).json({
              success: false,
              message: "Invalid releaseDate",
            });
          }
          updateFields[key] = d;
        } else if (key === "genreIds") {
          const arr = Array.isArray(body[key])
            ? (body[key] as unknown[]).filter((g) => isValidObjectId(g))
            : [];
          if (arr.length === 0) {
            return res.status(400).json({
              success: false,
              message: "genreIds must be a non-empty array of valid IDs",
            });
          }
          updateFields[key] = arr;
        } else if (
          requiredRefFields.includes(key as (typeof requiredRefFields)[number])
        ) {
          if (!isValidObjectId(body[key])) {
            return res.status(400).json({
              success: false,
              message: `Invalid ${key} (must be a valid ID)`,
            });
          }
          updateFields[key] = body[key];
        } else {
          updateFields[key] =
            typeof body[key] === "string" ? body[key].trim() : body[key];
        }
      }
    }
    const filmEnquiry = await FilmEnquiry.findByIdAndUpdate(id, updateFields, {
      new: true,
    }).populate("contentType genreIds country language");
    if (!filmEnquiry) {
      return res.status(404).json({
        success: false,
        message: "Film enquiry not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Film enquiry updated successfully",
      data: filmEnquiry,
    });
  } catch (error: any) {
    if (error?.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message || "Validation failed",
      });
    }
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
