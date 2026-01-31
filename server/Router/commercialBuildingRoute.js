const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authMiddleware");

const {
  createBuilding,
  getBuildings,
  updateBuilding,
  deleteBuilding,
  addFloor,
  updateFloor,
  deleteFloor,
  addUnit,
  updateUnit,
  deleteUnit,
} = require("../controllers/commercialBuildingController");

// 🔐 Protect EVERYTHING below this line
router.use(authenticate);

// ===== BUILDING =====
router.post("/buildings", createBuilding);
router.get("/buildings", getBuildings);
router.put("/buildings/:id", updateBuilding);
router.delete("/buildings/:id", deleteBuilding);

// ===== FLOOR =====
router.post("/buildings/:buildingId/floors", addFloor);
router.put("/floors/:id", updateFloor);
router.delete("/floors/:id", deleteFloor);

// ===== UNIT =====
router.post("/floors/:floorId/units", addUnit);
router.put("/units/:id", updateUnit);
router.delete("/units/:id", deleteUnit);

module.exports = router;
