module.exports = (sequelize, DataTypes) => {
  const CommercialBuilding = sequelize.define("CommercialBuilding", {
    name: { type: DataTypes.STRING, allowNull: false },
    address: { type: DataTypes.STRING, allowNull: false },
  });

  CommercialBuilding.associate = (models) => {
    // One building has many floors
    CommercialBuilding.hasMany(models.commercialFloor, {
      foreignKey: "buildingId",
      as: "floors",
      onDelete: "CASCADE",
    });
  };

  return CommercialBuilding;
};
