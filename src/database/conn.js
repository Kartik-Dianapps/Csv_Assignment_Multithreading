const mongoose = require("mongoose");
const dotenv = require("dotenv").config()

async function connection() {
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log("Connection Successful..");
    }
    catch (error) {
        console.log("Connection to Mongodb Failed...");
    }
}

module.exports = connection;