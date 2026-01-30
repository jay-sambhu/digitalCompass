const { HouseCompass } = require("../models");

// ZONE DEFINITIONS
const zonesData = {
  NORMAL: [
    { zone: "N", meaning: "Career & opportunities", nature: "GOOD" },
    { zone: "NE", meaning: "Spiritual growth & clarity", nature: "GOOD" },
    { zone: "E", meaning: "Health & vitality", nature: "GOOD" },
    { zone: "SE", meaning: "Fire, energy & finance", nature: "MIXED" },
    { zone: "S", meaning: "Fame & confidence", nature: "MIXED" },
    { zone: "SW", meaning: "Stability & relationships", nature: "BAD" },
    { zone: "W", meaning: "Wealth & savings", nature: "GOOD" },
    { zone: "NW", meaning: "Movement & support", nature: "MIXED" }
  ],

  "16_ZONE": [
    { zone: "N", meaning: "Career growth", nature: "GOOD" },
    { zone: "NNE", meaning: "Mental clarity", nature: "GOOD" },
    { zone: "NE", meaning: "Divine energy", nature: "GOOD" },
    { zone: "ENE", meaning: "Communication", nature: "GOOD" },

    { zone: "E", meaning: "Health", nature: "GOOD" },
    { zone: "ESE", meaning: "Fire balance", nature: "MIXED" },
    { zone: "SE", meaning: "Energy & power", nature: "BAD" },
    { zone: "SSE", meaning: "Aggression", nature: "BAD" },

    { zone: "S", meaning: "Reputation", nature: "MIXED" },
    { zone: "SSW", meaning: "Water imbalance", nature: "BAD" },
    { zone: "SW", meaning: "Stability", nature: "BAD" },
    { zone: "WSW", meaning: "Expenses", nature: "BAD" },

    { zone: "W", meaning: "Wealth", nature: "GOOD" },
    { zone: "WNW", meaning: "Support system", nature: "GOOD" },
    { zone: "NW", meaning: "Travel", nature: "MIXED" },
    { zone: "NNW", meaning: "New opportunities", nature: "GOOD" }
  ],

  "32_ZONE": [
    { zone: "N1", meaning: "Leadership", nature: "GOOD" },
    { zone: "N2", meaning: "Career stability", nature: "GOOD" },

    { zone: "NNE1", meaning: "Sharp thinking", nature: "GOOD" },
    { zone: "NNE2", meaning: "Decision making", nature: "GOOD" },

    { zone: "NE1", meaning: "Higher spirituality", nature: "GOOD" },
    { zone: "NE2", meaning: "Wisdom & intuition", nature: "GOOD" },

    { zone: "ENE1", meaning: "Speech power", nature: "GOOD" },
    { zone: "ENE2", meaning: "Social networking", nature: "GOOD" },

    { zone: "E1", meaning: "Physical health", nature: "GOOD" },
    { zone: "E2", meaning: "Mental health", nature: "GOOD" },

    { zone: "ESE1", meaning: "Fire imbalance", nature: "MIXED" },
    { zone: "ESE2", meaning: "Electrical energy", nature: "MIXED" },

    { zone: "SE1", meaning: "Aggression", nature: "BAD" },
    { zone: "SE2", meaning: "Money leakage", nature: "BAD" },

    { zone: "SSE1", meaning: "Stress", nature: "BAD" },
    { zone: "SSE2", meaning: "Anger issues", nature: "BAD" },

    { zone: "S1", meaning: "Authority", nature: "MIXED" },
    { zone: "S2", meaning: "Recognition", nature: "MIXED" },

    { zone: "SSW1", meaning: "Water defect", nature: "BAD" },
    { zone: "SSW2", meaning: "Energy loss", nature: "BAD" },

    { zone: "SW1", meaning: "Foundation stability", nature: "BAD" },
    { zone: "SW2", meaning: "Relationship issues", nature: "BAD" },

    { zone: "WSW1", meaning: "Expenditure", nature: "BAD" },
    { zone: "WSW2", meaning: "Debt risk", nature: "BAD" },

    { zone: "W1", meaning: "Savings", nature: "GOOD" },
    { zone: "W2", meaning: "Cash flow", nature: "GOOD" },

    { zone: "WNW1", meaning: "Helpful people", nature: "GOOD" },
    { zone: "WNW2", meaning: "Support energy", nature: "GOOD" },

    { zone: "NW1", meaning: "Movement", nature: "MIXED" },
    { zone: "NW2", meaning: "New chances", nature: "GOOD" }
  ],

  CHAKRA: [
    { zone: "N", meaning: "Root chakra - stability", nature: "GOOD" },
    { zone: "NE", meaning: "Crown chakra - consciousness", nature: "GOOD" },
    { zone: "E", meaning: "Heart chakra - health", nature: "GOOD" },
    { zone: "SE", meaning: "Solar plexus - fire", nature: "MIXED" },
    { zone: "S", meaning: "Sacral chakra - emotions", nature: "MIXED" },
    { zone: "SW", meaning: "Root imbalance", nature: "BAD" },
    { zone: "W", meaning: "Throat chakra - wealth flow", nature: "GOOD" },
    { zone: "NW", meaning: "Movement energy", nature: "MIXED" }
  ]
};

// SCORE CALCULATOR (0–100)
const calculateScore = (zones) => {
  let rawScore = 0;
  const maxScore = zones.length * 2;

  zones.forEach(z => {
    if (z.nature === "GOOD") rawScore += 2;
    else if (z.nature === "MIXED") rawScore += 1;
  });

  return Math.round((rawScore / maxScore) * 100);
};

//  POST /api/houses/:houseId/compass/analyze
exports.selectAndAnalyzeCompass = async (req, res) => {
  try {
    const { houseId } = req.params;
    const { compassType } = req.body;

    if (!compassType || !zonesData[compassType]) {
      return res.status(400).json({
        success: false,
        message: "Invalid compass type"
      });
    }

    const analysis = zonesData[compassType];
    const score = calculateScore(analysis);

    let compass = await HouseCompass.findOne({ where: { houseId } });

    if (compass) {
      compass.compassType = compassType;
      compass.analysis = analysis;
      compass.score = score;
      await compass.save();
    } else {
      compass = await HouseCompass.create({
        houseId,
        compassType,
        analysis,
        score
      });
    }

    return res.status(200).json({
      success: true,
      message: "Compass analyzed successfully",
      data: compass
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
