const {sequelize} = require("../db/db.config");
const {DataTypes} = require("sequelize");

const db = {};

db.userProfile = require("./userModule")(sequelize, DataTypes);
db.houseProject = require("./houseProjectModule")(sequelize,DataTypes);
db.floorPlan = require("./floorPlanModule")(sequelize,DataTypes);

db.sequelize = sequelize;
db.DataTypes = DataTypes;

module.exports = db;