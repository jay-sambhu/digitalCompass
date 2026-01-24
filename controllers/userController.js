const db = require('../models');
const UserProfile = db.userProfile;

const SaveUserProfile = async (req, res)=>{
    try {
        const {name, email, userName, password} = req.body;
        const newUser = await UserProfile.create({
           name,
           email,
           userName,
           password
        });
        return res.status(201).json({message:"User profile saved successfully "});
        

    }
    catch (error){
        console.error("Error while saving user profile:", error);
        return res.status(500).json({message:"Error while saving user profile"});
    }
};
const updateUser = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await UserProfile.findByPk(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await user.update(req.body);

    res.json({
      message: "User updated successfully",
      data: user
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await UserProfile.findByPk(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await user.destroy();

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { SaveUserProfile, updateUser, deleteUser };