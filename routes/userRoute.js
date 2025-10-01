const express = require("express");
const { registerUser, loginUser, logoutUser, fetchSalesData, insertSalesData, updateSalesData, deleteSalesData } = require("../Controller/userController");
const verifyToken = require("../middleware/auth");
const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", verifyToken, logoutUser)
router.get("/fetch", verifyToken, fetchSalesData)
router.patch("/updateSalesRecord/:id", verifyToken, updateSalesData)
router.delete("/deleteSalesRecord/:id", verifyToken, deleteSalesData)
router.post("/addSalesRecord", verifyToken, insertSalesData)

module.exports = router;