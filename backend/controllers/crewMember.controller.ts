import CrewMember from "../models/crewMember.model.js";
import CrewAssignment from "../models/crewAssignment.model.js";
import Nomination from "../models/nomination.model.js";

export const getCrewMembers = async (req, res) => {
  try {
    const items = await CrewMember.find();
    res.status(200).json({
      success: true,
      message: "Crew members fetched successfully",
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

export const getCrewMember = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await CrewMember.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Crew member not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Crew member fetched successfully",
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

export const createCrewMember = async (req, res) => {
  try {
    const {
      name,
      biography = "",
      profilePicture = "",
      instagramUrl = "",
      description = "",
    } = req.body || {};
    if (!name || typeof name !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Name is required" });
    }
    const created = await CrewMember.create({
      name,
      biography,
      profilePicture,
      instagramUrl,
      description,
    });
    res.status(201).json({
      success: true,
      message: "Crew member created successfully",
      data: created,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateCrewMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, biography, profilePicture, instagramUrl, description } = req.body || {};
    const updated = await CrewMember.findByIdAndUpdate(
      id,
      {
        $set: {
          ...(name !== undefined ? { name } : {}),
          ...(biography !== undefined ? { biography } : {}),
          ...(profilePicture !== undefined ? { profilePicture } : {}),
          ...(instagramUrl !== undefined ? { instagramUrl } : {}),
          ...(description !== undefined ? { description } : {}),
        },
      },
      { new: true }
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Crew member not found" });
    }
    res.status(200).json({
      success: true,
      message: "Crew member updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Deletes a person and the assignments that linked them to films.
 *
 * The two dependents are treated differently on purpose.
 *
 * `CrewAssignment` is a join row and nothing more — person, role, submission.
 * With the person gone it describes nobody, so it is cascaded. Leaving it was
 * the old behaviour, and it is why assignments in production point at crew
 * members that no longer exist.
 *
 * A `Nomination` is award history. Detaching a winner from their award as a
 * side effect of tidying the crew directory is not something a delete button
 * should do quietly, so this refuses instead and says how many are in the way.
 */
export const deleteCrewMember = async (req, res) => {
  try {
    const { id } = req.params;

    const nominated = await Nomination.countDocuments({ crewMemberId: id });
    if (nominated > 0) {
      return res.status(409).json({
        success: false,
        message: `This person is named on ${nominated} nomination${nominated === 1 ? "" : "s"} and cannot be deleted. Update those first.`,
        nominated,
      });
    }

    // Before the person, not after: if this throws, the member survives and
    // the request can simply be retried. deleteMany is idempotent, so a retry
    // costs nothing. The reverse order is what leaves orphans behind.
    const { deletedCount } = await CrewAssignment.deleteMany({
      crewMemberId: id,
    });

    const deleted = await CrewMember.findByIdAndDelete(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Crew member not found" });
    }
    res.status(200).json({
      success: true,
      message: `Crew member deleted successfully${deletedCount ? `, along with ${deletedCount} crew assignment${deletedCount === 1 ? "" : "s"}` : ""}`,
      removedAssignments: deletedCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
