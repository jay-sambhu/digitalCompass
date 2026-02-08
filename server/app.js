const express = require("express");
const dotenv = require('dotenv');
dotenv.config();
const houseRouter = require('./Router/houseRouter');
const userRouter = require('./Router/userRouter');
// const commercialBuildingRoute = require('./Router/commercialBuildingRoute');

const db = require("./models");

const app = express();
const PORT = process.env.PORT || 3000;

//middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//server status
app.get("/", (req, res) => {
  res.send("Server is running");
});

//routes
app.use('/api/user', userRouter);
app.use('/api/houses', houseRouter);
// app.use(('/api/buildings'), commercialBuildingRoute);

//database syancing and server start
db.sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
}).catch((error) => {
  console.error("Unable to sync database:", error);
});
