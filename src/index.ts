import express from "express";
import cors from "cors";
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
import drizzlePaymentRoutes from "#drizzleRoutes/payment.routes.js";
import { handleStripeWebhook } from "#drizzleControllers/webhook.controller.js";

const app = express();
const port = process.env.port ?? "9000";

const corsOptions = {
  origin: ["https://fix-bee-gamma.vercel.app"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Middleware to capture raw body for webhooks
app.use(
  "/api/payments/webhooks/stripe",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    (req as any).rawBody = req.body;
    next();
  },
);

app.use(express.json());
app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));

// Webhook route (after raw body capture middleware)
app.post("/api/payments/webhooks/stripe", handleStripeWebhook);

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
app.use("/payments", drizzlePaymentRoutes);

// Only start server if not in Vercel environment

// app.listen(port, () => {
//   console.log(`Server started on http://localhost:${port}`);
//   startJobs();
// });

// stripe listen --forward-to localhost:3001/api/payments/webhooks/stripe

export default app;
