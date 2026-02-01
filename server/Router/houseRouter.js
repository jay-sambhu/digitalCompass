const express = require("express");
const router = express.Router();

// Import the middleware functions
const { authenticate } = require("../middleware/authmiddleware");

// Import your controllers
const houseController = require("../controllers/houseController");
const floorPlanController = require("../controllers/floorPlanController");

/* --- HOUSE PROJECT ROUTES --- */
router.post("/", authenticate, houseController.createHouse);
router.get("/", authenticate, houseController.getHouses);
router.get("/:id", authenticate, houseController.getHouseById);
router.delete("/:id", authenticate, houseController.deleteHouse);
router.patch("/:id/north", authenticate, houseController.updateNorthAngle);

/* --- FLOOR PLAN ROUTES --- */
router.post("/:houseId/floor-plan", authenticate, floorPlanController.uploadFloorPlan);

module.exports = router;