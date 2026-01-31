const { FloorPlan, HouseProject } = require("../models");

/**
 * UPLOAD FLOOR PLAN
 * POST /api/houses/:houseId/floor-plan
 */
exports.uploadFloorPlan = async (req, res) => {
  try {
    const { imageUrl, width, height } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: "imageUrl is required"
      });
    }

    const house = await HouseProject.findOne({
      where: {
        id: req.params.houseId,
        userId: req.user.id
      }
    });

    if (!house) {
      return res.status(404).json({
        success: false,
        message: "House not found"
      });
    }

    // If floor plan already exists, replace it
    let floorPlan = await FloorPlan.findOne({
      where: { houseId: house.id }
    });

    if (floorPlan) {
      floorPlan.imageUrl = imageUrl;
      floorPlan.width = width;
      floorPlan.height = height;
      await floorPlan.save();
    } else {
      floorPlan = await FloorPlan.create({
        houseId: house.id,
        imageUrl,
        width,
        height
      });
    }

    return res.status(201).json({
      success: true,
      data: floorPlan
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
