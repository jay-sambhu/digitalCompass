module.exports = (sequelize, DataTypes) => {
  const HouseCompass = sequelize.define(
    "HouseCompass",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      houseId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      compassType: {
        type: DataTypes.ENUM("NORMAL", "16_ZONE", "32_ZONE", "CHAKRA"),
        allowNull: false,
      },
      analysis: { type: DataTypes.JSON, allowNull: true }, // store zones + meanings
      score: { type: DataTypes.INTEGER, allowNull: true }, // optional Vastu score
    },
    {
      tableName: "house_compass",
      timestamps: true,
    },
  );

  HouseCompass.associate = (models) => {
    HouseCompass.belongsTo(models.houseProject, {
      foreignKey: "houseId",
      as: "house",
      onDelete: "CASCADE",
    });
  };

  return HouseCompass;
};
