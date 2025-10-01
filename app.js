const express = require("express")
const dotenv = require("dotenv").config()
const app = express();
const connection = require("./src/database/conn.js")
const userRouter = require("./src/routes/userRoute.js");
const fileCheck = require("./src/cron/fileCheckCron.js");

connection();

const port = process.env.PORT || 4000;

app.use(express.json())
app.use("/user", userRouter)

fileCheck()

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})