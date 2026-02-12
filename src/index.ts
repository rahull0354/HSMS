import express from "express"
import connectDB from "#config/connectDB.js"
import { startJobs } from "#config/jobs.js"

import customerRoutes from "#routes/customer.routes.js"
import serviceProviderRoutes from "#routes/serviceProvider.routes.js"
import adminRoutes from "#routes/admin.routes.js"

const app = express()
const port = process.env.port ?? "9000"

app.use(express.json())
app.use(express.urlencoded({extended: true}))

app.use("/customer", customerRoutes)
app.use("/serviceProvider", serviceProviderRoutes)
app.use("/admin", adminRoutes)

app.listen(port, () => {
    connectDB()
    console.log(`Server started on http://localhost:${port}`)
    startJobs()
})