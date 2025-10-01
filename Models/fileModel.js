const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
    filename: {
        type: String
    },
    filePath: {
        type: String
    },
    status: {
        type: String,
        enum: ["pending", "processing", "done", "error"],
        default: "pending"
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
}, { timestamps: true })

const File = mongoose.model("File", fileSchema);

module.exports = File;