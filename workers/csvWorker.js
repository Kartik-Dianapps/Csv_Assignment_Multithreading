const { parentPort } = require("worker_threads");
const mongoose = require("mongoose");
const dotenv = require("dotenv").config();
const Sales = require("../Models/salesModel");

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

        Sales.insertMany(rows,{ordered:true})
            .then(() => {
                parentPort.postMessage({ type: "batch_done", workerId, inserted: rows.length });
            })
            .catch(err => {
                console.error("Worker caught insert error:", err);

                const writeErrors = (err.writeErrors || []).map(e => ({
                    index: e.index,
                    errmsg: e.errmsg || e.message
                }));

                const serialized = {
                    name: err.name,
                    message: err.message,
                    code: err.code,
                    writeErrors
                };

                parentPort.postMessage({ type: "batch_error", workerId, error: serialized });

                // Signal batch done so main thread can continue
                parentPort.postMessage({ type: "batch_done", workerId, inserted: 0 });
            });
    };

    waitForConnection();
});
