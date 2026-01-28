const db = require("../models");
const { CommercialBuilding, Floor, Unit } = db;

// --------------------- BUILDING ---------------------

// Create a new building
const createBuilding = async (req, res) => {
  try {
    const { name, address } = req.body;
    const building = await CommercialBuilding.create({ name, address });
    res.status(201).json(building);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all buildings with floors and units
const getBuildings = async (req, res) => {
  try {
    const buildings = await CommercialBuilding.findAll({
      include: {
        model: Floor,
        as: "floors",
        include: { model: Unit, as: "units" },
      },
    });
    res.status(200).json(buildings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update a building
const updateBuilding = async (req, res) => {
  try {
    const { id } = req.params;
    const building = await CommercialBuilding.findByPk(id);
    if (!building) return res.status(404).json({ message: "Building not found" });

    await building.update(req.body);
    res.status(200).json(building);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete a building
const deleteBuilding = async (req, res) => {
  try {
    const { id } = req.params;
    const building = await CommercialBuilding.findByPk(id);
    if (!building) return res.status(404).json({ message: "Building not found" });

    await building.destroy();
    res.status(200).json({ message: "Building deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --------------------- FLOOR ---------------------

// Add a floor to a building
const addFloor = async (req, res) => {
  try {
    const { buildingId } = req.params;
    const { floorNumber } = req.body;

    const building = await CommercialBuilding.findByPk(buildingId);
    if (!building) return res.status(404).json({ message: "Building not found" });

    const floor = await Floor.create({ floorNumber, buildingId });
    res.status(201).json(floor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update a floor
const updateFloor = async (req, res) => {
  try {
    const { id } = req.params;
    const floor = await Floor.findByPk(id);
    if (!floor) return res.status(404).json({ message: "Floor not found" });

    await floor.update(req.body);
    res.status(200).json(floor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete a floor
const deleteFloor = async (req, res) => {
  try {
    const { id } = req.params;
    const floor = await Floor.findByPk(id);
    if (!floor) return res.status(404).json({ message: "Floor not found" });

    await floor.destroy();
    res.status(200).json({ message: "Floor deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --------------------- UNIT ---------------------

// Add a unit to a floor
const addUnit = async (req, res) => {
  try {
    const { floorId } = req.params;
    const { unitNumber, type, area, occupied } = req.body;

    const floor = await Floor.findByPk(floorId);
    if (!floor) return res.status(404).json({ message: "Floor not found" });

    const unit = await Unit.create({ unitNumber, type, area, occupied, floorId });
    res.status(201).json(unit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update a unit
const updateUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const unit = await Unit.findByPk(id);
    if (!unit) return res.status(404).json({ message: "Unit not found" });

    await unit.update(req.body);
    res.status(200).json(unit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete a unit
const deleteUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const unit = await Unit.findByPk(id);
    if (!unit) return res.status(404).json({ message: "Unit not found" });

    await unit.destroy();
    res.status(200).json({ message: "Unit deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
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
};
