const express = require("express");
const router = express.Router();
const { selectAndAnalyzeCompass } = require("../controllers/compassController");

// User selects compass and analyzes house
router.post("/houses/:houseId/compass/analyze", selectAndAnalyzeCompass);

module.exports = router;
