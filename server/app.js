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

// not-found handler
app.use((req, res) => {
  console.error(`[404] ${req.method} ${req.originalUrl}`);
  res.status(404).json({ message: "Route not found" });
});

// centralized error handler
app.use((err, req, res, next) => {
  console.error(`[EXPRESS_ERROR] ${req.method} ${req.originalUrl}`);
  console.error(err?.stack || err);
  res.status(err?.status || 500).json({
    message: err?.message || "Internal server error",
  });
});

//database syancing and server start
db.sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
}).catch((error) => {
  console.error("Unable to sync database:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED_REJECTION]");
  console.error(reason);
});

process.on("uncaughtException", (error) => {
  console.error("[UNCAUGHT_EXCEPTION]");
  console.error(error?.stack || error);
});
