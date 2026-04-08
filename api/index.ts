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
      webhook: "/api/payments/webhooks/stripe",
      debug: "/debug-env",
      webhookTest: "/test-webhook",
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
    databaseHost: dbUrl.includes('@') ? dbUrl.split('@')[1]?.split(':')[0] : 'not found',
    stripeKeysConfigured: {
      publishableKey: !!process.env.STRIPE_PUBLISHABLE_KEY,
      secretKey: !!process.env.STRIPE_SECRET_KEY,
      webhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
    }
  });
});

// Test webhook endpoint
app.post("/test-webhook", (req, res) => {
  console.log("\n========== TEST WEBHOOK ==========");
  console.log("🧪 [TEST WEBHOOK] Request received");
  console.log("🧪 [TEST WEBHOOK] Method:", req.method);
  console.log("🧪 [TEST WEBHOOK] URL:", req.url);
  console.log("🧪 [TEST WEBHOOK] Headers:", JSON.stringify(req.headers, null, 2));
  console.log("🧪 [TEST WEBHOOK] Content-Type:", req.get("content-type"));
  console.log("🧪 [TEST WEBHOOK] Stripe signature:", req.headers["stripe-signature"]);

  // Check if raw body was captured
  const rawBody = (req as any).rawBody;
  const rawBodyBuffer = (req as any).rawBodyBuffer;

  console.log("🧪 [TEST WEBHOOK] Raw body (any):", !!rawBody);
  console.log("🧪 [TEST WEBHOOK] Raw body buffer:", !!rawBodyBuffer);
  console.log("🧪 [TEST WEBHOOK] Raw body type:", typeof rawBody);
  console.log("🧪 [TEST WEBHOOK] Raw body length:", rawBody?.length || 0);
  console.log("🧪 [TEST WEBHOOK] Req.body type:", typeof req.body);
  console.log("🧪 [TEST WEBHOOK] Req.body keys:", Object.keys(req.body || {}));

  // Try to parse the body
  try {
    if (rawBodyBuffer && Buffer.isBuffer(rawBodyBuffer)) {
      const parsed = JSON.parse(rawBodyBuffer.toString('utf8'));
      console.log("🧪 [TEST WEBHOOK] Successfully parsed raw body as JSON");
      console.log("🧪 [TEST WEBHOOK] Parsed data:", JSON.stringify(parsed, null, 2));
    }
  } catch (e) {
    console.error("🧪 [TEST WEBHOOK] Failed to parse raw body:", e);
  }

  console.log("========== TEST WEBHOOK END ==========\n");

  res.status(200).json({
    message: "Test webhook received",
    success: true,
    rawBodyCaptured: !!rawBody,
    rawBodyBufferCaptured: !!rawBodyBuffer,
    bodyType: typeof req.body,
    contentType: req.get("content-type"),
    stripeSignaturePresent: !!req.headers["stripe-signature"]
  });
});

// Export for Vercel serverless
export default app;
