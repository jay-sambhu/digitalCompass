module.exports = (sequelize, DataTypes) => {
  const floorPlan = sequelize.define(
    "floorPlan",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      houseId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      imageUrl: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      length:{
        type: DataTypes.INTEGER,
        allowNull:true
      },
      width: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      height: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    },
    {
      tableName: "floor_plans",
      timestamps: true
    }
  );

  floorPlan.associate = (models) => {
    floorPlan.belongsTo(models.houseProject, {
      foreignKey: "houseId",
      as: "house"
    });
  };

  return floorPlan;
};
