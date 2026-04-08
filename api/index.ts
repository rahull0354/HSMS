import app from "../src/index.js";

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    message: "HomeServiceManagement API",
    status: "running",
    endpoints: {
      health: "/health",
      customers: "/customers",
      providers: "/providers",
      admin: "/author",
      requests: "/request",
      reviews: "/review",
      invoices: "/invoices",
      payments: "/payments",
    },
  });
});

// Export for Vercel serverless
export default app;
