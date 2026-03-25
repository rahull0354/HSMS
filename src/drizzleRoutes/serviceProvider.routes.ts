import {
  deactivateAccount,
  getAllServiceProviders,
  getDashboardStats,
  getMonthlyEarnings,
  getMonthlyPerformance,
  getProfileDetails,
  getProvidersByCategory,
  getPublicProfile,
  loginServiceProvider,
  registerServiceProvider,
  requestReactivation,
  searchProviders,
  toggleAvailability,
  updateServiceProviderDetails,
  verifyAndReactivateAccount,
} from "#drizzleControllers/serviceProvider.controller.js";
import { drizzleAuthMiddleware } from "#middlewares/drizzleAuth.middleware.js";
import express from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "#drizzleControllers/notification.controller.js";

const router = express.Router();

router.post("/register", registerServiceProvider);
router.post("/login", loginServiceProvider);

router.post("/request-reactivation", requestReactivation);
router.get("/reactivate-account/:token", verifyAndReactivateAccount);
router.get('/list', getAllServiceProviders)
router.get("/list/profile/:serviceProviderId", getPublicProfile)
router.get('/list/search', searchProviders)
router.get('/by-category', getProvidersByCategory)

router.get("/dashboard", drizzleAuthMiddleware(["serviceProvider"]), getDashboardStats);

// // middleware protected routes
router.put(
  "/profile",
  drizzleAuthMiddleware(["serviceProvider"]),
  updateServiceProviderDetails,
);
router.post(
  "/deactivate-account",
  drizzleAuthMiddleware(["serviceProvider"]),
  deactivateAccount,
);
router.get("/profile", drizzleAuthMiddleware(["serviceProvider"]), getProfileDetails);
router.put(
  "/toggleAvailability",
  drizzleAuthMiddleware(["serviceProvider"]),
  toggleAvailability,
);

// Notification routes (must come before /:id route)
router.get(
  "/notifications",
  drizzleAuthMiddleware(["serviceProvider"]),
  getNotifications
);
router.patch(
  "/notifications/:id/read",
  drizzleAuthMiddleware(["serviceProvider"]),
  markAsRead
);
router.patch(
  "/notifications/read-all",
  drizzleAuthMiddleware(["serviceProvider"]),
  markAllAsRead
);
router.delete(
  "/notifications/:id",
  drizzleAuthMiddleware(["serviceProvider"]),
  deleteNotification
);
router.get(
  "/notifications/preferences",
  drizzleAuthMiddleware(["serviceProvider"]),
  getNotificationPreferences
);
router.put(
  "/notifications/preferences",
  drizzleAuthMiddleware(["serviceProvider"]),
  updateNotificationPreferences
);

// Dashboard charts endpoints
router.get("/dashboard/monthly-earnings", drizzleAuthMiddleware(["serviceProvider"]), getMonthlyEarnings);
router.get("/dashboard/monthly-performance", drizzleAuthMiddleware(["serviceProvider"]), getMonthlyPerformance);

export default router;
