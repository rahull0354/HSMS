import express from "express";
import cors from "cors";

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

// Get allowed origins from environment
const getAllowedOrigins = () => {
  const frontendUrl = process.env.FRONTEND_URL;
  const vercelUrl = process.env.VERCEL_URL;

  const origins = [
    "http://localhost:3000",
    "https://fix-bee-gamma.vercel.app"
  ];

  if (frontendUrl) {
    origins.push(frontendUrl);
  }

  if (vercelUrl) {
    origins.push(`https://${vercelUrl}`);
  }

  return origins;
};

const corsOptions = {
  origin: getAllowedOrigins(),
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Stripe webhook middleware - must be before JSON parsing
app.use('/api/payments/webhooks/stripe', express.raw({ type: 'application/json' }), (req, res, next) => {
  (req as any).rawBody = req.body;
  next();
});

app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Webhook route
app.post('/api/payments/webhooks/stripe', handleStripeWebhook);

// MongoDB routes
app.use("/customer", customerRoutes);
app.use("/serviceProvider", serviceProviderRoutes);
app.use("/admin", adminRoutes);
app.use("/serviceRequest", serviceRequestRoutes);
app.use("/reviews", reviewRoutes);

// PostgreSQL routes (Drizzle)
app.use("/customers", drizzleCustomerRoutes);
app.use("/providers", drizzleServiceProviderRoutes);
app.use("/author", drizzleAdminRoutes);
app.use("/request", drizzleRequestRoutes);
app.use("/review", drizzleReviewRoutes);
app.use("/invoices", drizzleInvoiceRoutes);
app.use("/payments", drizzlePaymentRoutes);

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// 404 handler
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Export for Vercel serverless
export default app;