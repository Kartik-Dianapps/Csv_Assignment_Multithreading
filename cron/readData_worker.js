const fs = require("fs");
const csv = require("csv-parser");
const { Worker } = require("worker_threads");
const { ObjectId } = require("mongodb");
const os = require("os");
const path = require("path");
const File = require("../Models/fileModel");

const THREAD_COUNT = 2;  // Keep small for memory control
const BATCH_SIZE = 2000;  // Smaller batches to prevent RAM spikes

async function processFile(file) {
    return new Promise((resolve, reject) => {
        const workers = [];
        const workerQueues = Array.from({ length: THREAD_COUNT }, () => []);
        const workerBusy = Array(THREAD_COUNT).fill(false);
        let finishedWorkers = 0;

        // Spawn workers
        for (let i = 0; i < THREAD_COUNT; i++) {
            const worker = new Worker(path.join(__dirname, "../workers/csvWorker.js"));
            worker.workerId = i;

            worker.on("message", (msg) => {
                switch (msg.type) {

                    case "batch_error":
                        console.error(`Worker ${msg.workerId} insert error: ${msg.error.name} - ${msg.error.message}`);
                        if (msg.error.writeErrors && msg.error.writeErrors.length) {
                            msg.error.writeErrors.forEach(we => {
                                console.error(`  → Duplicate row at index ${we.index}: ${we.errmsg}`);
                            });
                        } else if (msg.error.errmsg) {
                            console.error(`  → MongoDB error: ${msg.error.errmsg}`);
                        }
                        break;

                    case "batch_done":
                        workerBusy[msg.workerId] = false;
                        sendNextBatch(msg.workerId);
                        console.log(`Worker ${msg.workerId} batch done, inserted ${msg.inserted || 0} rows`);
                        break;

                    case "finished":
                        finishedWorkers++;
                        if (finishedWorkers === THREAD_COUNT) resolve();
                        break;
                }
            });

            worker.on("error", err => console.error(`Worker ${i} error:`, err));
            worker.on("exit", code => console.log(`Worker ${i} exited with code ${code}`));
            workers.push(worker);
        }

        function sendNextBatch(workerId) {
            if (workerQueues[workerId].length === 0 || workerBusy[workerId]) return;
            const batch = workerQueues[workerId].shift();
            workerBusy[workerId] = true;
            workers[workerId].postMessage({ rows: batch, workerId });
        }

        const readable = fs.createReadStream(file.filePath, { encoding: "utf8" }).pipe(csv());
        let rowBuffer = [];
        let nextWorker = 0;
        const seenOrderIds = new Set();

        readable.on("data", (row) => {
            const orderId = row["Order ID"]?.trim();
            if (!orderId || seenOrderIds.has(orderId)) return;

            seenOrderIds.add(orderId);
            rowBuffer.push({
                Region: row.Region?.trim(),
                Country: row.Country?.trim(),
                ItemType: row['Item Type']?.trim(),
                SalesChannel: row['Sales Channel']?.trim(),
                OrderPriority: row['Order Priority']?.trim(),
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
                const batch = rowBuffer.splice(0, BATCH_SIZE);
                workerQueues[nextWorker].push(batch);
                sendNextBatch(nextWorker);

                nextWorker = (nextWorker + 1) % THREAD_COUNT;

                // Pause stream if queues are full
                if (workerQueues.every((q, i) => q.length >= 2)) readable.pause();
            }
        });

        readable.on("end", () => {
            if (rowBuffer.length > 0) {
                workerQueues[nextWorker].push(rowBuffer);
                sendNextBatch(nextWorker);
            }
            workers.forEach(worker => worker.postMessage("done"));
        });

        readable.on("error", async (err) => {
            console.error("Stream error:", err.message);
            workers.forEach(w => w.terminate());
            reject(err);
        });

        // Resume stream when queue has space
        const resumeInterval = setInterval(() => {
            if (workerQueues.some(q => q.length < 2)) readable.resume();
            if (finishedWorkers === THREAD_COUNT) clearInterval(resumeInterval);
        }, 50);
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
        await File.updateOne({ _id: file._id }, { status: "done" });

        await fs.promises.unlink(file.filePath);
    }
}

module.exports = processPendingFiles;
