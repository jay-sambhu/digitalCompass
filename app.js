const express = require("express");

const db = require("./models");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.use('/api', require('./Router/userRouter'));

db.sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
}).catch((error) => {
  console.error("Unable to sync database:", error);
});
