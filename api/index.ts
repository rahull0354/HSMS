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
      debug: "/debug-env",
    },
  });
});

// Debug endpoint to check environment variables
app.get("/debug-env", (req, res) => {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    return res.status(500).json({
      error: "DATABASE_URL not found in environment",
      env: process.env.NODE_ENV,
      databaseUrlSet: false
    });
  }

  // Show partial connection string for security
  const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');

  return res.status(200).json({
    message: "Environment variables loaded",
    env: process.env.NODE_ENV,
    databaseUrlSet: true,
    databaseUrlPreview: maskedUrl,
    databaseHost: dbUrl.includes('@') ? dbUrl.split('@')[1]?.split(':')[0] : 'not found'
  });
});

// Export for Vercel serverless
export default app;
