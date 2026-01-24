const express = require("express");
const router = express.Router();

const {SaveUserProfile, updateUser, deleteUser} = require("../controllers/userController");
const db = require("../models");
const UserProfile = db.userProfile;

router.post("/user", SaveUserProfile);
router.get("/user", async (req,res)=>
{
    try{
        const rows = await UserProfile.findAll();
        return res.status(200).json(rows);
    }
    catch(error){
        return res.status(500).json({message:"Error while fetching the records"});
    }
});
router.get("/user/:id", async (req,res)=>{
    try{
        const id = req.params.id;
        const row = await UserProfile.findByPk(id);
        if(row){
            return res.status(200).json(row);

        }
        else{
            return res.status(404).json({message:"user not found in the database"});

        }
    }
    catch(error){
        return res.status(500).json({message:"Error while fetching the data from the database"});

    }
});
router.put("/user/:id", updateUser);
router.delete("/user/:id", deleteUser);


module.exports = router;