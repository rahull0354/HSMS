import express from "express";
import {
  deactivateAccount,
  getProfileDetails,
  loginCustomer,
  registerCustomer,
  requestReactivation,
  updateCustomerDetails,
  verifyAndReactivateAccount,
  refreshAccessToken,
  logout,
  getActiveSessions,
  revokeSession,
  logoutAll,
} from "../drizzleControllers/customer.controller.js";
import { getCustomerById } from "../drizzleControllers/admin.controller.js";
import { drizzleAuthMiddleware } from "#middlewares/drizzleAuth.middleware.js";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "#drizzleControllers/notification.controller.js";

const router = express.Router();

router.post("/register", registerCustomer);
router.post("/login", loginCustomer);
router.post("/refresh-token", refreshAccessToken);
router.post("/request-reactivation", requestReactivation);
router.get("/reactivate-account/:token", verifyAndReactivateAccount);

// auth protected rojutes
router.put(
  "/update-profile",
  drizzleAuthMiddleware(["customer"]),
  updateCustomerDetails,
);

router.post(
  "/deactivate-account",
  drizzleAuthMiddleware(["customer"]),
  deactivateAccount,
);

router.post("/logout", drizzleAuthMiddleware(["customer"]), logout);
router.get("/profile", drizzleAuthMiddleware(["customer"]), getProfileDetails);

// Session management routes
router.get("/sessions", drizzleAuthMiddleware(["customer"]), getActiveSessions);
router.delete(
  "/sessions/:sessionId",
  drizzleAuthMiddleware(["customer"]),
  revokeSession,
);
router.post("/logout-all", drizzleAuthMiddleware(["customer"]), logoutAll);

// Notification routes (must come before /:id route)
router.get(
  "/notifications",
  drizzleAuthMiddleware(["customer"]),
  getNotifications
);
router.patch(
  "/notifications/:id/read",
  drizzleAuthMiddleware(["customer"]),
  markAsRead
);
router.patch(
  "/notifications/read-all",
  drizzleAuthMiddleware(["customer"]),
  markAllAsRead
);
router.delete(
  "/notifications/:id",
  drizzleAuthMiddleware(["customer"]),
  deleteNotification
);
router.get(
  "/notifications/preferences",
  drizzleAuthMiddleware(["customer"]),
  getNotificationPreferences
);
router.put(
  "/notifications/preferences",
  drizzleAuthMiddleware(["customer"]),
  updateNotificationPreferences
);

router.get("/:customerId", drizzleAuthMiddleware(["serviceProvider", "admin"]), getCustomerById);

export default router;
