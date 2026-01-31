const { HouseProject, FloorPlan } = require("../models");

/**
 * CREATE HOUSE
 * POST /api/houses
 */
exports.createHouse = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "House name is required"
      });
    }

    const house = await HouseProject.create({
      userId: req.user.id,
      name
    });

    return res.status(201).json({
      success: true,
      data: house
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * GET ALL HOUSES (LOGGED IN USER)
 * GET /api/houses
 */
exports.getHouses = async (req, res) => {
  try {
    const houses = await HouseProject.findAll({
      where: { userId: req.user.id },
      include: [
        {
          model: FloorPlan,
          as: "floorPlan"
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    return res.json({
      success: true,
      data: houses
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * GET SINGLE HOUSE
 * GET /api/houses/:id
 */
exports.getHouseById = async (req, res) => {
  try {
    const house = await HouseProject.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      },
      include: [
        {
          model: FloorPlan,
          as: "floorPlan"
        }
      ]
    });

    if (!house) {
      return res.status(404).json({
        success: false,
        message: "House not found"
      });
    }

    return res.json({
      success: true,
      data: house
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * DELETE HOUSE
 * DELETE /api/houses/:id
 */
exports.deleteHouse = async (req, res) => {
  try {
    const deleted = await HouseProject.destroy({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "House not found"
      });
    }

    return res.json({
      success: true,
      message: "House deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * UPDATE NORTH ANGLE
 * PATCH /api/houses/:id/north
 */
exports.updateNorthAngle = async (req, res) => {
  try {
    const { northAngle } = req.body;

    if (northAngle === undefined) {
      return res.status(400).json({
        success: false,
        message: "northAngle is required"
      });
    }

    const house = await HouseProject.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!house) {
      return res.status(404).json({
        success: false,
        message: "House not found"
      });
    }

    house.northAngle = northAngle;
    await house.save();

    return res.json({
      success: true,
      data: house
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
