import express from "express";
import cors from "cors";
import connectDB from "#config/connectDB.js";
import { startJobs } from "#config/jobs.js";

import customerRoutes from "#routes/customer.routes.js";
import serviceProviderRoutes from "#routes/serviceProvider.routes.js";
import adminRoutes from "#routes/admin.routes.js";
import serviceRequestRoutes from "#routes/serviceRequest.routes.js";
import reviewRoutes from "#routes/review.route.js";

import drizzleCustomerRoutes from "#drizzleRoutes/customer.routes.js";
import drizzleServiceProviderRoutes from "#drizzleRoutes/serviceProvider.routes.js";
import drizzleAdminRoutes from "#drizzleRoutes/admin.routes.js";
import drizzleRequestRoutes from "#drizzleRoutes/serviceRequest.routes.js";
import drizzleReviewRoutes from "#drizzleRoutes/reviews.routes.js";
import drizzleInvoiceRoutes from "#drizzleRoutes/invoice.routes.js";

const app = express();
const port = process.env.port ?? "9000";

const corsOptions = {
  origin: ["http://localhost:3000",],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(express.json());
app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));

app.use("/customer", customerRoutes);
app.use("/serviceProvider", serviceProviderRoutes);
app.use("/admin", adminRoutes);
app.use("/serviceRequest", serviceRequestRoutes);
app.use("/reviews", reviewRoutes);

// drizzle routes
app.use("/customers", drizzleCustomerRoutes);
app.use("/providers", drizzleServiceProviderRoutes);
app.use("/author", drizzleAdminRoutes);
app.use("/request", drizzleRequestRoutes);
app.use("/review", drizzleReviewRoutes);
app.use("/invoices", drizzleInvoiceRoutes);

app.listen(port, () => {
//   connectDB();
  console.log(`Server started on http://localhost:${port}`);
  startJobs();
});
