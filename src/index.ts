import express from "express"
import customerRoutes from "#routes/customer.routes.js"
import connectDB from "#config/connectDB.js"
import { startJobs } from "#config/jobs.js"

const app = express()
const port = process.env.port ?? "9000"

app.use(express.json())
app.use(express.urlencoded({extended: true}))

app.use("/customer", customerRoutes)

app.listen(port, () => {
    connectDB()
    console.log(`Server started on http://localhost:${port}`)
    startJobs()
})