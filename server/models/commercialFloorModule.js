module.exports = (sequelize, DataTypes) => {
  const CommercialFloor = sequelize.define("CommercialFloor", {
    floorNumber: { type: DataTypes.INTEGER, allowNull: false },
  });

  CommercialFloor.associate = (models) => {
    // One floor belongs to one building
    CommercialFloor.belongsTo(models.commercialBuilding, {
      foreignKey: "buildingId",
      as: "building",
      onDelete: "CASCADE",
    });

    // One floor has many units
    CommercialFloor.hasMany(models.commercialUnit, {
      foreignKey: "floorId",
      as: "units",
      onDelete: "CASCADE",
    });
  };

  return CommercialFloor;
};
