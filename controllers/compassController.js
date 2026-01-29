// controllers/compassController.js

const { HouseCompass } = require("../models");

// Zone definitions
const zonesData = {
  NORMAL: [
    { zone: "N", meaning: "Career & growth" },
    { zone: "NE", meaning: "Spirituality & wisdom" },
    { zone: "E", meaning: "Health" },
    { zone: "SE", meaning: "Energy & fire" },
    { zone: "S", meaning: "Fame & strength" },
    { zone: "SW", meaning: "Stability & relationships" },
    { zone: "W", meaning: "Finance & gains" },
    { zone: "NW", meaning: "Support & movement" }
  ],
  "16_ZONE": [
    { zone: "N", meaning: "Career" },
    { zone: "NNE", meaning: "Mental clarity" },
    { zone: "NE", meaning: "Divine energy" },
    { zone: "ENE", meaning: "Communication" },
    { zone: "E", meaning: "Health" },
    { zone: "ESE", meaning: "Fire balance" },
    { zone: "SE", meaning: "Energy & power" },
    { zone: "SSE", meaning: "Aggression control" },
    { zone: "S", meaning: "Reputation" },
    { zone: "SSW", meaning: "Avoid water" },
    { zone: "SW", meaning: "Stability" },
    { zone: "WSW", meaning: "Expenses" },
    { zone: "W", meaning: "Wealth" },
    { zone: "WNW", meaning: "Support system" },
    { zone: "NW", meaning: "Travel" },
    { zone: "NNW", meaning: "Opportunities" }
  ],
  "32_ZONE": [
    { zone: "NNE", meaning: "Mental clarity" },
    { zone: "NE", meaning: "Divine energy" },
    { zone: "ENE", meaning: "Communication" },
    { zone: "E", meaning: "Health" },
    { zone: "ESE", meaning: "Fire balance" },
    { zone: "SE", meaning: "Energy & power" },
    { zone: "SSE", meaning: "Aggression control" },
    { zone: "S", meaning: "Reputation" },
    { zone: "SSW", meaning: "Avoid water" },
    { zone: "SW", meaning: "Stability" },
    { zone: "WSW", meaning: "Expenses" },
    { zone: "W", meaning: "Wealth" },
    { zone: "WNW", meaning: "Support system" },
    { zone: "NW", meaning: "Travel" },
    { zone: "NNW", meaning: "Opportunities" },
    { zone: "N", meaning: "Career" }
  ],
  CHAKRA: [
    { zone: "N", meaning: "Growth" },
    { zone: "NE", meaning: "Spiritual energy" },
    { zone: "E", meaning: "Health" },
    { zone: "SE", meaning: "Fire & power" },
    { zone: "S", meaning: "Strength" },
    { zone: "SW", meaning: "Stability" },
    { zone: "W", meaning: "Money & wealth" },
    { zone: "NW", meaning: "Movement & support" }
  ]
};

// POST /api/houses/:houseId/compass/analyze
exports.selectAndAnalyzeCompass = async (req, res) => {
  try {
    const houseId = req.params.houseId;
    const { compassType } = req.body;

    if (!compassType || !zonesData[compassType]) {
      return res.status(400).json({ message: "Invalid compass type" });
    }

    // Analyze → just fetch zones + optional score
    const analysis = zonesData[compassType];

    // Simple scoring: more zones = higher score
    const score = analysis.length * 5 + Math.floor(Math.random() * 10); // just example

    // Save or update
    let selection = await HouseCompass.findOne({ where: { houseId } });
    if (selection) {
      selection.compassType = compassType;
      selection.analysis = analysis;
      selection.score = score;
      await selection.save();
    } else {
      selection = await HouseCompass.create({
        houseId,
        compassType,
        analysis,
        score
      });
    }

    return res.status(200).json({
      success: true,
      message: "Compass selected and analyzed",
      data: selection
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
