module.exports = (sequelize, DataTypes) => {
  const houseProject = sequelize.define(
    "houseProject",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      userId: {
        type: DataTypes.INTEGER,   //matches with userprofile id 
        allowNull: false
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      northAngle: {
        type: DataTypes.FLOAT,
        allowNull: true
      }
    },
    {
      tableName: "house_project",
      timestamps: true
    }
  );

  houseProject.associate = (models) => {
    houseProject.hasOne(models.FloorPlan, {
      foreignKey: "houseId",
      as: "floorPlan",
      onDelete: "CASCADE" //while deleting user id it also delete the associated house projects
    });
  };

  return houseProject;
};
