const express = require("express");
const router = express.Router();

const { SaveUserProfile, updateUser, deleteUser, loginUser } = require("../controllers/userController");
const db = require("../models");
const UserProfile = db.userProfile;

// Create new user
router.post("/user", SaveUserProfile);

// Get all users (exclude passwords)
router.get("/user", async (req, res) => {
    try {
        const rows = await UserProfile.findAll({ attributes: { exclude: ['password'] } });
        return res.status(200).json(rows);
    } catch (error) {
        return res.status(500).json({ message: "Error while fetching the records" });
    }
});

// Get single user by ID (exclude password)
router.get("/user/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const row = await UserProfile.findByPk(id, { attributes: { exclude: ['password'] } });
        if (row) {
            return res.status(200).json(row);
        } else {
            return res.status(404).json({ message: "User not found in the database" });
        }
    } catch (error) {
        return res.status(500).json({ message: "Error while fetching the data from the database" });
    }
});

// Update user by ID
router.put("/user/:id", updateUser);

// Delete user by ID
router.delete("/user/:id", deleteUser);

// User login route
router.post("/login", loginUser);

module.exports = router;
