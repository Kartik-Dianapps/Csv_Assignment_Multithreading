const fs = require("fs");
const csv = require("csv-parser");
const File = require("../Models/fileModel");
const Sales = require("../Models/salesModel");

async function processCsv(file, batchSize = 2000) {
    console.log("Inside Process CSV");

    const check = fs.existsSync(file.filePath);
    console.log("File exists:", check);

    if (!check) {
        console.log("File does not exist");
        await File.updateOne({ _id: file._id }, { status: "error" });
        return;
    }

    await File.updateOne({ _id: file._id }, { status: "processing" });

    let rows = [];

    let set = new Set();

    const readable = fs.createReadStream(file.filePath, { encoding: "utf8" }).pipe(csv());

    readable.on("data", (row) => {
        const OrderId = row['Order ID'];
        if (!OrderId || set.has(OrderId)) return;

        set.add(OrderId);

        rows.push({
            Region: row.Region,
            Country: row.Country,
            ItemType: row['Item Type'],
            SalesChannel: row['Sales Channel'],
            OrderPriority: row['Order Priority'],
            OrderDate: row['Order Date'],
            OrderId,
            ShipDate: row['Ship Date'],
            UnitsSold: row['Units Sold'],
            UnitPrice: row['Unit Price'],
            UnitCost: row['Unit Cost'],
            TotalRevenue: row['Total Revenue'],
            TotalCost: row['Total Cost'],
            TotalProfit: row['Total Profit'],
            userId: file.userId
        });

        if (rows.length >= batchSize) {
            const batch = rows.splice(0, batchSize);
            Sales.insertMany(batch, { ordered: false }).then(() => {
                console.log("Inserted batch of", batch.length, "rows");
            }).catch((err) => { console.log(err.message) })
            set.clear()
        }
    });

    readable.on("end", async () => {
        if (rows.length > 0) {
            Sales.insertMany(rows, { ordered: false }).then(() => {
                console.log("Inserted batch of", rows.length, "rows");
            }).catch((err) => { console.log(err.message) })
        }

        await File.updateOne({ _id: file._id }, { status: "done" });
        console.log("File processing done for:", file.filename);

        try {
            await fs.promises.unlink(file.filePath);
            console.log("Deleted file:", file.filePath);
        } catch (err) {
            console.log("Error deleting file:", err.message);
        }
    });

    readable.on("error", async (err) => {
        console.error("Stream error:", err.message);
        await File.updateOne({ _id: file._id }, { status: "error" });
    })
}

async function insertData() {
    try {
        const files = await File.find({ status: "pending" });
        for (let file of files) {
            await processCsv(file);
        }
    } catch (error) {
        console.log(error.message);
    }
}

module.exports = insertData;
