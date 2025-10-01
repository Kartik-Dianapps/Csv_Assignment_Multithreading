const { parentPort } = require("worker_threads");
const mongoose = require("mongoose");
const dotenv = require("dotenv").config();
const Sales = require("../models/salesModel");

let isConnected = false;

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("Worker connected to MongoDB");
        isConnected = true;
    })
    .catch(err => console.error("Worker MongoDB connection error:", err));

parentPort.on("message", (msg) => {
    if (msg === "done") {
        parentPort.postMessage({ type: "finished" });
        return;
    }

    const { rows, workerId } = msg;
    if (!rows || rows.length === 0) return;

    const waitForConnection = () => {
        if (!isConnected) return setTimeout(waitForConnection, 50);

        Sales.insertMany(rows, { ordered: false })
            .then(() => {
                parentPort.postMessage({ type: "batch_done", workerId, inserted: rows.length });
            })
            .catch(err => {
                console.log("Worker caught insert error:", err.message)

                // Signal batch done so main thread can continue
                parentPort.postMessage({ type: "batch_done", workerId, inserted: 0 });
            });
    };

    waitForConnection();
});
