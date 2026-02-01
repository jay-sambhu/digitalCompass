const {sequelize} = require("../db/db.config");
const {DataTypes} = require("sequelize");

const db = {};

db.userProfile = require("./userModule")(sequelize, DataTypes);
<<<<<<< HEAD:models/index.js
db.HouseProject = require("./houseProjectModule")(sequelize,DataTypes);
db.FloorPlan = require("./floorPlanModule")(sequelize,DataTypes);
=======
db.houseProject = require("./houseProjectModule")(sequelize,DataTypes);
db.floorPlan = require("./floorPlanModule")(sequelize,DataTypes);
db.commercialBuilding = require("./commercialBuildingModule")(sequelize,DataTypes);
db.commercialFloor = require("./commercialFloorModule")(sequelize,DataTypes);
>>>>>>> bd21c7b4e811fa667f4c1049a546f1882cc9dcc6:server/models/index.js

db.sequelize = sequelize;
db.DataTypes = DataTypes;

module.exports = db;