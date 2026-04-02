import {
  cancelPayment,
  confirmPayment,
  createPaymentIntent,
  getPaymentHistory,
  getPaymentStats,
  getPaymentStatus,
} from "#drizzleControllers/payment.controller.js";
import { handleStripeWebhook } from "#drizzleControllers/webhook.controller.js";
import { drizzleAuthMiddleware } from "#middlewares/drizzleAuth.middleware.js";
import express from "express";

const router = express.Router();

// Customer routes - Payment operations
router.post(
  "/create-intent",
  drizzleAuthMiddleware(["customer"]),
  createPaymentIntent
);
router.post("/confirm", drizzleAuthMiddleware(["customer"]), confirmPayment);
router.post("/cancel", drizzleAuthMiddleware(["customer"]), cancelPayment);
router.get(
  "/history",
  drizzleAuthMiddleware(["customer", "admin"]),
  getPaymentHistory
);
router.get(
  "/:paymentId/status",
  drizzleAuthMiddleware(["customer", "admin"]),
  getPaymentStatus
);

// Admin routes - Statistics
router.get("/stats", drizzleAuthMiddleware(["admin"]), getPaymentStats);




export default router;
