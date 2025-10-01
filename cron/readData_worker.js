const fs = require("fs");
const csv = require("csv-parser");
const { Worker } = require("worker_threads");
const { ObjectId } = require("mongodb")
const os = require("os");
const path = require("path")
const File = require("../Models/fileModel");

// const THREAD_COUNT = Math.max(1, os.cpus().length - 2);
const THREAD_COUNT = 2;
const BATCH_SIZE = 1000;

async function processFile(file) {
    return new Promise((resolve, reject) => {
        let workers = [];
        let finishedCount = 0;
        let rowBuffer = [];
        let nextWorker = 0;
        let set = new Set();

        // Spawn workers
        for (let i = 0; i < THREAD_COUNT; i++) {
            const worker = new Worker(path.join(__dirname, "../workers/csvWorker.js"));
            worker.workerId = i;

            worker.on("message", msg => {
                console.log(`Worker ${i}: ${msg}`);
                if (msg === "finished") {
                    finishedCount++;
                    if (finishedCount === THREAD_COUNT) {
                        console.log(`File processing done: ${file.filename}`);
                        File.updateOne({ _id: file._id }, { status: "done" }).catch((e) => { console.log(e.message) });
                        workers.forEach(w => w.terminate());
                        resolve();
                    }
                }
            });

            worker.on("error", err => console.error(`Worker ${i} error: ${err}`));
            worker.on("exit", code => console.log(`Worker ${i} exited with code ${code}`));
            workers.push(worker);
        }

        const readable = fs.createReadStream(file.filePath, { encoding: "utf8" }).pipe(csv());

        readable.on("data", row => {
            const orderId = row["Order ID"];
            if (!orderId || set.has(orderId)) {
                console.log("Inside the duplicate check...")
                return;
            }

            // console.log(row)
            set.add(orderId);
            rowBuffer.push({
                Region: row.Region,
                Country: row.Country,
                ItemType: row['Item Type'],
                SalesChannel: row['Sales Channel'],
                OrderPriority: row['Order Priority'],
                OrderDate: new Date(row['Order Date']),
                OrderId: orderId,
                ShipDate: new Date(row['Ship Date']),
                UnitsSold: Number(row['Units Sold']),
                UnitPrice: Number(row['Unit Price']),
                UnitCost: Number(row['Unit Cost']),
                TotalRevenue: Number(row['Total Revenue']),
                TotalCost: Number(row['Total Cost']),
                TotalProfit: Number(row['Total Profit']),
                userId: file.userId.toString()
            });


            if (rowBuffer.length >= BATCH_SIZE) {
                // console.log("Inside the if");
                // console.log(rowBuffer);

                const batch = rowBuffer.splice(0, BATCH_SIZE);
                workers[nextWorker].postMessage({ rows: batch, workerId: nextWorker });
                nextWorker = (nextWorker + 1) % THREAD_COUNT;
                set.clear();
            }
        });

        readable.on("end", () => {
            if (rowBuffer.length > 0) {
                workers[nextWorker].postMessage({ rows: rowBuffer, workerId: nextWorker });
            }
            workers.forEach(worker => worker.postMessage("done"));
        });

        readable.on("error", async (err) => {
            console.error("Stream error:", err.message);
            await File.updateOne({ _id: file._id }, { status: "error" });
            workers.forEach(w => w.terminate());
            reject(err);
        });
    });
}

async function processPendingFiles() {
    const files = await File.find({ status: "pending" });
    for (const file of files) {
        if (!fs.existsSync(file.filePath)) {
            console.error(`File not found: ${file.filename}`);
            await File.updateOne({ _id: file._id }, { status: "error" });
            continue;
        }

        await File.updateOne({ _id: file._id }, { status: "processing" });
        await processFile(file);
    }
}

module.exports = processPendingFiles;
