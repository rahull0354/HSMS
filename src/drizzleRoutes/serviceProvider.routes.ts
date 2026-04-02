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
import {
  getMyPayoutById,
  getMyPayouts,
  getMyPayoutSummary,
  getMyPendingInvoices,
} from "#drizzleControllers/payout.controller.js";
import {
  addBankAccount,
  deleteBankAccount,
  getBankAccountById,
  getMyBankAccounts,
  getMyPrimaryBankAccount,
  setAsPrimary,
  updateBankAccount,
} from "#drizzleControllers/bankAccount.controller.js";
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
router.get("/list", getAllServiceProviders);
router.get("/list/profile/:serviceProviderId", getPublicProfile);
router.get("/list/search", searchProviders);
router.get("/by-category", getProvidersByCategory);

router.get(
  "/dashboard",
  drizzleAuthMiddleware(["serviceProvider"]),
  getDashboardStats,
);

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
router.get(
  "/profile",
  drizzleAuthMiddleware(["serviceProvider"]),
  getProfileDetails,
);
router.put(
  "/toggleAvailability",
  drizzleAuthMiddleware(["serviceProvider"]),
  toggleAvailability,
);

// Notification routes (must come before /:id route)
router.get(
  "/notifications",
  drizzleAuthMiddleware(["serviceProvider"]),
  getNotifications,
);
router.patch(
  "/notifications/:id/read",
  drizzleAuthMiddleware(["serviceProvider"]),
  markAsRead,
);
router.patch(
  "/notifications/read-all",
  drizzleAuthMiddleware(["serviceProvider"]),
  markAllAsRead,
);
router.delete(
  "/notifications/:id",
  drizzleAuthMiddleware(["serviceProvider"]),
  deleteNotification,
);
router.get(
  "/notifications/preferences",
  drizzleAuthMiddleware(["serviceProvider"]),
  getNotificationPreferences,
);
router.put(
  "/notifications/preferences",
  drizzleAuthMiddleware(["serviceProvider"]),
  updateNotificationPreferences,
);

// Dashboard charts endpoints
router.get(
  "/dashboard/monthly-earnings",
  drizzleAuthMiddleware(["serviceProvider"]),
  getMonthlyEarnings,
);
router.get(
  "/dashboard/monthly-performance",
  drizzleAuthMiddleware(["serviceProvider"]),
  getMonthlyPerformance,
);

// Payout management routes
router.get(
  "/payouts",
  drizzleAuthMiddleware(["serviceProvider"]),
  getMyPayouts,
);
router.get(
  "/payouts/summary",
  drizzleAuthMiddleware(["serviceProvider"]),
  getMyPayoutSummary,
);
router.get(
  "/payouts/pending",
  drizzleAuthMiddleware(["serviceProvider"]),
  getMyPendingInvoices,
);
router.get(
  "/payouts/:payoutId",
  drizzleAuthMiddleware(["serviceProvider"]),
  getMyPayoutById,
);

// Bank account management routes
router.post(
  "/bank-accounts",
  drizzleAuthMiddleware(["serviceProvider"]),
  addBankAccount,
);
router.get(
  "/bank-accounts",
  drizzleAuthMiddleware(["serviceProvider"]),
  getMyBankAccounts,
);
router.get(
  "/bank-accounts/primary",
  drizzleAuthMiddleware(["serviceProvider"]),
  getMyPrimaryBankAccount,
);
router.get(
  "/bank-accounts/:bankAccountId",
  drizzleAuthMiddleware(["serviceProvider"]),
  getBankAccountById,
);
router.put(
  "/bank-accounts/:bankAccountId",
  drizzleAuthMiddleware(["serviceProvider"]),
  updateBankAccount,
);
router.delete(
  "/bank-accounts/:bankAccountId",
  drizzleAuthMiddleware(["serviceProvider"]),
  deleteBankAccount,
);
router.patch(
  "/bank-accounts/:bankAccountId/set-primary",
  drizzleAuthMiddleware(["serviceProvider"]),
  setAsPrimary,
);

export default router;
