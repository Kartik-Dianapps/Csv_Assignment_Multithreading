const User = require("../Models/userModel.js")
const bcrypt = require("bcrypt");
const dotenv = require("dotenv").config();
const jwt = require("jsonwebtoken");
const Session = require("../Models/SessionModel.js");
const { ObjectId } = require("mongodb");
const Sales = require("../Models/salesModel.js");

const registerUser = async (req, res) => {
    try {
        const data = req.body;

        const name = data.name
        const email = data.email;
        const password = data.password

        if (name === null || name === undefined || name === "" || name.trim() === "") {
            return res.status(400).json({ message: "Name field cannot be empty or undefined or empty String..." })
        }

        if (email === null || email === undefined) {
            return res.status(400).json({ message: "Email cannot be null or undefined..." })
        }

        const emailRegex = /^[a-zA-Z0-9]{3,}@[a-zA-Z]+\.[a-zA-Z]{2,}$/;

        const emailCheck = emailRegex.test(email);

        if (!emailCheck) {
            return res.status(400).json({ message: "Please Provide a valid email..." })
        }

        const existingEmail = await User.findOne({ email: email }).collation({ locale: "en", strength: 1 })

        if (existingEmail) {
            return res.status(400).json({ message: "User already exists with this email id..." })
        }

        if (password === null || password === undefined || password === "") {
            return res.status(400).json({ message: "Cannot provide password as null or undefined or empty string..." })
        }

        if (password.length < 8) {
            return res.status(400).json({ message: "Please provide minimum 8 length password..." })
        }

        let hashed = await bcrypt.hash(password, Number(process.env.SALT_ROUNDS))

        const newUser = await User.create({ name: name, email: email, password: hashed });
        console.log(newUser);

        return res.status(201).json({ user: { name: newUser.name, email: newUser.email }, message: "New User registered Successfully..." })
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Registration Failed..." })
    }
}

const loginUser = async (req, res) => {
    try {
        const data = req.body;

        const email = data.email;
        const password = data.password

        if (email === null || email === undefined || email === "" || email.trim() === "") {
            return res.status(400).json({ message: "Cannot provide email null or undefined or empty String..." })
        }

        const user = await User.findOne({ email: email })

        if (!user) {
            return res.status(404).json({ message: "User not exists with this email..." })
        }

        const checkPassword = await bcrypt.compare(password, user.password);

        if (!checkPassword) {
            return res.status(400).json({ message: "Please enter correct password..." })
        }

        const token = jwt.sign({ userId: user._id, name: user.name }, process.env.SECRET_KEY, { expiresIn: "1d" });

        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await Session.create({ userId: user._id, token: token, tokenExpiry: tokenExpiry });

        return res.status(200).json({ name: user.name, email: user.email, token: token, message: "Login Successful..." })
    }
    catch (error) {
        console.log(error.message);
        return res.status(500).json({ message: "Login Failed..." })
    }
}

const logoutUser = async (req, res) => {
    try {
        let token = req.headers.authorization;
        token = token.substring(token.indexOf(" ") + 1);

        const id = req.userId;

        await Session.deleteOne({ userId: new ObjectId(id), token: token })

        return res.status(200).json({ message: "Logout Successfully..." })

    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ message: "Logout Failed..." })
    }
}

const fetchSalesData = async (req, res) => {
    try {

        let { limit, pageNo, sortBy, sortOrder, search } = req.query;

        limit = limit ? Number(limit) : 10
        pageNo = pageNo ? Number(pageNo) - 1 : 0
        sortBy = sortBy ? sortBy : "Country"

        const skipPages = pageNo * limit

        const sortOptions = ["Region", "Country", "ItemType", "OrderId"];
        const sortOrders = [1, -1];
        sortOrder = Number(sortOrder)

        if (!sortOptions.includes(sortBy)) {
            return res.status(400).json({ message: "Cannot sortBy other than Region, Country, ItemType, OrderId" })
        }

        if (!sortOrders.includes(sortOrder)) {
            return res.status(400).json({ message: "Cannot provide sort order other than 1 and -1" })
        }

        let total
        let totalPages;
        let data;

        if (search) {
            total = await Sales.countDocuments({ userId: req.userId, $or: [{ Region: { $regex: search, $options: "i" } }, { Country: { $regex: search, $options: "i" } }, { ItemType: { $regex: search, $options: "i" } }] })
            totalPages = Math.ceil(total / limit)
            data = await Sales.find({ userId: req.userId, $or: [{ Region: { $regex: search, $options: "i" } }, { Country: { $regex: search, $options: "i" } }, { ItemType: { $regex: search, $options: "i" } }] }).skip(skipPages).limit(limit).sort({ [sortBy]: sortOrder })
        }
        else {
            total = await Sales.countDocuments({ userId: req.userId })
            totalPages = Math.ceil(total / limit)
            data = await Sales.find({ userId: req.userId }).skip(skipPages).limit(limit).sort({ [sortBy]: sortOrder })
        }

        return res.status(200).json({ data: data, paginationDetails: { totalRecords: total, totalPages: totalPages, currentPage: pageNo + 1, limit: limit }, message: `Sales Data fetched successfully....` })
    }
    catch (error) {
        console.log(error.message);
        return res.status(500).json({ message: "Error occurred while fetching..." })
    }
}

const updateSalesData = async (req, res) => {
    try {
        const id = req.params.id;

        const data = req.body

        const record = await Sales.findOne({ _id: id })

        if (!record) {
            return res.status(400).json({ message: "Please provide valid id..." })
        }

        let { Region, Country, ItemType, SalesChannel, OrderPriority, OrderDate, OrderId, ShipDate, UnitsSold, UnitPrice, UnitCost, TotalRevenue, TotalCost, TotalProfit } = data

        let orderIdExists;

        if (OrderId && OrderId.trim() !== "" && OrderId.trim() !== record.OrderId) {
            orderIdExists = await Sales.findOne({ _id: { $ne: id }, OrderId: OrderId.trim() })

            if (orderIdExists) {
                return res.status(400).json({ message: "Order Id already exists..." })
            }
        }

        Region = Region ? Region.trim() : record.Region
        Country = Country ? Country.trim() : record.Country
        ItemType = ItemType ? ItemType.trim() : record.ItemType
        SalesChannel = SalesChannel ? SalesChannel.trim() : record.SalesChannel
        OrderPriority = OrderPriority ? OrderPriority.trim() : record.OrderPriority
        OrderDate = OrderDate ? OrderDate.trim() : record.OrderDate
        OrderId = OrderId ? OrderId.trim() : record.OrderId
        ShipDate = ShipDate ? ShipDate.trim() : record.ShipDate
        UnitsSold = (UnitsSold || UnitsSold === 0) ? UnitsSold : record.UnitsSold
        UnitPrice = UnitPrice ? UnitPrice : record.UnitPrice
        UnitCost = UnitCost ? UnitCost : record.UnitCost
        TotalRevenue = TotalRevenue ? TotalRevenue : record.TotalRevenue
        TotalCost = TotalCost ? TotalCost : record.TotalCost
        TotalProfit = TotalProfit ? TotalProfit : record.TotalProfit

        if (!Region || !Country || !ItemType || !SalesChannel || !OrderPriority || !OrderDate || !OrderId || !ShipDate) {
            return res.status(400).json({ message: "Any field cannot be empty string if you want to update..." })
        }

        const updated = await Sales.updateOne({ _id: id }, { $set: { Region, Country, ItemType, SalesChannel, OrderPriority, OrderDate, OrderId, ShipDate, UnitsSold, UnitPrice, UnitCost, TotalRevenue, TotalCost, TotalProfit } })

        if (updated.modifiedCount === 0) {
            return res.status(200).json({ message: "Nothing updated..." })
        }

        const updatedData = await Sales.findOne({ _id: id })

        return res.status(200).json({ updatedData: updatedData, message: "Sales record Updated Successfully..." })
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error Occurred while updating..." })
    }
}

const deleteSalesData = async (req, res) => {
    try {
        const id = req.params.id;

        const record = await Sales.findById(id)

        if (!record) {
            return res.status(400).json({ message: "Record Not Found..." })
        }

        await Sales.deleteOne({ _id: id })

        return res.status(200).json({ deletedData: record, message: "Sales record deleted successfully..." })
    }
    catch (error) {
        console.log(error.message)
        return res.status(500).json({ message: "Error Occurred while deleting..." })
    }
}

const insertSalesData = async (req, res) => {
    try {
        const data = req.body;

        if (!data.Region || data.Region.trim() === "") {
            return res.status(400).json({ message: "Region is required..." })
        }

        if (!data.Country || data.Country.trim() === "") {
            return res.status(400).json({ message: "Country is required..." })
        }

        if (!data.ItemType || data.ItemType.trim() === "") {
            return res.status(400).json({ message: "ItemType is required..." })
        }

        if (!data.SalesChannel || data.SalesChannel.trim() === "") {
            return res.status(400).json({ message: "SalesChannel is required..." })
        }

        if (!data.OrderPriority || data.OrderPriority.trim() === "") {
            return res.status(400).json({ message: "OrderPriority is required..." })
        }

        if (!data.OrderDate || data.OrderDate.trim() === "") {
            return res.status(400).json({ message: "OrderDate is required..." })
        }

        if (!data.OrderId || data.OrderId.trim() === "") {
            return res.status(400).json({ message: "OrderId is required..." })
        }

        if (!data.ShipDate || data.ShipDate.trim() === "") {
            return res.status(400).json({ message: "ShipDate is required..." })
        }

        if (data.UnitsSold === null || data.UnitsSold === undefined || data.UnitsSold === "") {
            return res.status(400).json({ message: "UnitsSold is required..." })
        }

        if (data.UnitPrice === null || data.UnitPrice === undefined || data.UnitPrice === "") {
            return res.status(400).json({ message: "UnitPrice is required..." })
        }

        if (data.TotalRevenue === null || data.TotalRevenue === undefined || data.TotalRevenue === "") {
            return res.status(400).json({ message: "TotalRevenue is required..." })
        }

        if (data.TotalCost === null || data.TotalCost === undefined || data.TotalCost === "") {
            return res.status(400).json({ message: "TotalCost is required..." })
        }

        if (data.TotalProfit === null || data.TotalProfit === undefined || data.TotalProfit === "") {
            return res.status(400).json({ message: "TotalProfit is required..." })
        }

        data.userId = req.userId;

        const orderIdExists = await Sales.findOne({ OrderId: data.OrderId.trim() })
        if (orderIdExists) {
            return res.status(400).json({ message: "Record with this given OrderId already exists..." })
        }

        const newRecord = await Sales.create(data);

        return res.status(201).json({ newRecord: newRecord, message: "Sales Record Created Successfully..." })
    }
    catch (error) {
        console.log(error);

        return res.status(500).json({ message: "Error while creating the new record..." })
    }
}

module.exports = { registerUser, loginUser, logoutUser, fetchSalesData, updateSalesData, deleteSalesData, insertSalesData }