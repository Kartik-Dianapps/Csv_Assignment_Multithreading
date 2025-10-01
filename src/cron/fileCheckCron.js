const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const File = require("../models/fileModel");
const Sales = require("../models/salesModel");
const insertData = require("./insertData");
const processPendingFiles = require("./readData_worker");

async function check() {
    try {

        const folderPath = path.join(__dirname, '../files');

        let filesArr = [];

        filesArr = await fs.promises.readdir(folderPath);

        for (let i = 0; i < filesArr.length; i++) {

            const total = filesArr[i].length - 4;

            if (filesArr[i].substring(total) !== '.csv') {
                continue;
            }

            const file = await File.findOne({ filename: filesArr[i], status: { $in: ["pending", "processing", "done", "error"] } })

            if (file) {
                if (file.status === "error") {

                    await Sales.deleteMany({ userId: file.userId });
                    await File.deleteOne({ _id: file._id })

                    console.log(`New file found ${filesArr[i]}`);
                    const id = filesArr[i].split("_")[1].substring(0, 24)
                    await File.create({ filename: filesArr[i], filePath: path.join(folderPath, filesArr[i]), userId: id })

                    await processPendingFiles()
                }
                else {
                    continue;
                }
            }
            else {
                console.log(`New file found ${filesArr[i]}`);
                const id = filesArr[i].split("_")[1].substring(0, 24)
                await File.create({ filename: filesArr[i], filePath: path.join(folderPath, filesArr[i]), userId: id })

                await processPendingFiles()
            }
        }
    }
    catch (error) {
        console.log(error.message);
    }
}

function fileCheck() {
    cron.schedule("* * * * *", async () => {
        await check()
    })
}

module.exports = fileCheck