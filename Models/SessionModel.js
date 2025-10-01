const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    token: {
        type: String,
        default: null
    },
    tokenExpiry: {
        type: Date,
        default: null
    }
}, { timestamps: true })

const Session = mongoose.model("Session", sessionSchema);

module.exports = Session;