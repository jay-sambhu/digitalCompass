const db = require('../models');
const UserProfile = db.userProfile;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Save new user profile
const SaveUserProfile = async (req, res) => {
    try {
        const { name, email, userName, password } = req.body;

        // Check all fields
        if (![name, email, userName, password].every(Boolean)) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Check if user already exists
        const existingUser = await UserProfile.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "User with this email already exists" });
        }

        const hash = await bcrypt.hash(password, 10);

        const newUser = await UserProfile.create({
            name,
            email,
            userName,
            password: hash
        });

        return res.status(201).json({ message: "User profile saved successfully", data: newUser });
    } catch (error) {
        console.error("Error while saving user profile:", error);
        return res.status(500).json({ message: "Error while saving user profile" });
    }
};

// Update user by ID
const updateUser = async (req, res) => {
    const { id } = req.params;

    try {
        const user = await UserProfile.findByPk(id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // If password is being updated, hash it
        if (req.body.password) {
            req.body.password = await bcrypt.hash(req.body.password, 10);
        }

        await user.update(req.body);
        res.json({ message: "User updated successfully", data: user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete user by ID
const deleteUser = async (req, res) => {
    const { id } = req.params;

    try {
        const user = await UserProfile.findByPk(id);
        if (!user) return res.status(404).json({ message: "User not found" });

        await user.destroy();
        res.json({ message: "User deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Login user
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const user = await UserProfile.findOne({ where: { email } });
        if (!user) return res.status(401).json({ message: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ message: "Login successful", token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get user by ID
const getUser = async (req, res) => {
    const { id } = req.params;

    try {
        const user = await UserProfile.findByPk(id, { attributes: { exclude: ['password'] } });
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json({ data: user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { SaveUserProfile, updateUser, deleteUser, loginUser, getUser };
