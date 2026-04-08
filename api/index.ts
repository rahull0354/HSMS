import app from "../src/index.js";

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    message: "HomeServiceManagement API",
    status: "running",
  });
});

// Export for Vercel serverless
export default app;
