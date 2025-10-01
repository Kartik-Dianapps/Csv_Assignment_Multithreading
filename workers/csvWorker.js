const { parentPort } = require("worker_threads");
const mongoose = require("mongoose");
const dotenv = require("dotenv").config();
const Sales = require("../Models/salesModel");

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("Worker connected to MongoDB");

        parentPort.on("message", msg => {

            console.log("WorkerId:", JSON.stringify(msg.workerId));
            // console.log("rows:",JSON.stringify(msg.rows))

            if (msg === "done") {
                parentPort.postMessage("finished");
                return;
            }
            const { rows, workerId } = msg;

            if (!rows || rows.length === 0) return;

            Sales.insertMany(rows, { ordered: false })
                .then(() => console.log(`Worker ${workerId} batch inserted`))
                .catch(err => console.error(err.message));

            parentPort.postMessage(`Worker ${workerId} batch sent to insert`);
        });
    });

