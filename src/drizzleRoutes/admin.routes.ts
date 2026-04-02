import {
  createCategory,
  deleteCategory,
  getAllCategories,
  getAllCustomers,
  getAllServiceProviders,
  getCategoryById,
  getCategoryBySlug,
  getCustomerById,
  getDashboardStats,
  getProfile,
  getServiceProviderById,
  getServiceDistribution,
  getRevenueDistribution,
  getServiceEarnings,
  loginAdmin,
  registerAdmin,
  suspendProvider,
  toggleCategoryStatus,
  unsuspendProvider,
  updateCategory,
} from "#drizzleControllers/admin.controller.js";
import {
  bulkInitiatePayouts,
  completePayout,
  failPayout,
  getAllPayouts,
  getPayoutById,
  getPendingPayouts,
  getPayoutStats,
  getProviderPayoutSummary,
  initiatePayout,
  processPayout,
} from "#drizzleControllers/payout.controller.js";
import {
  getAllBankAccounts,
  verifyBankAccount,
} from "#drizzleControllers/bankAccount.controller.js";
import { drizzleAuthMiddleware } from "#middlewares/drizzleAuth.middleware.js";
import express from "express";

const router = express.Router();

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);

// dashboard management routes
router.get("/dashboard", drizzleAuthMiddleware(["admin"]), getDashboardStats);
router.get("/service-distribution", drizzleAuthMiddleware(["admin"]), getServiceDistribution);
router.get("/revenue-distribution", drizzleAuthMiddleware(["admin"]), getRevenueDistribution);
router.get("/service-earnings/:requestId", drizzleAuthMiddleware(["admin"]), getServiceEarnings);

// middleware protected routes
router.get("/profile", drizzleAuthMiddleware(["admin"]), getProfile);

// service category routes
router.post(
  "/createCategory",
  drizzleAuthMiddleware(["admin"]),
  createCategory,
);
router.get(
  "/categories",
  drizzleAuthMiddleware(["admin", "customer", "serviceProvider"]),
  getAllCategories,
);
router.get(
  "/category/:categoryId",
  drizzleAuthMiddleware(["admin"]),
  getCategoryById,
);
router.get(
  "/category/slug/:slug",
  drizzleAuthMiddleware(["admin", "customer"]),
  getCategoryBySlug,
);
router.put(
  "/category/update/:categoryId",
  drizzleAuthMiddleware(["admin"]),
  updateCategory,
);
router.patch(
  "/category/:categoryId/toggle",
  drizzleAuthMiddleware(["admin"]),
  toggleCategoryStatus,
);
router.delete(
  "/category/delete/:categoryId",
  drizzleAuthMiddleware(["admin"]),
  deleteCategory,
);

// service provider routes
router.get(
  "/serviceProviders",
  drizzleAuthMiddleware(["admin"]),
  getAllServiceProviders,
);
router.get(
  "/serviceProvider/:serviceProviderId",
  drizzleAuthMiddleware(["admin"]),
  getServiceProviderById,
);
router.patch(
  "/serviceProvider/suspend/:serviceProviderId",
  drizzleAuthMiddleware(["admin"]),
  suspendProvider,
);
router.patch(
  "/serviceProvider/un-suspend/:serviceProviderId",
  drizzleAuthMiddleware(["admin"]),
  unsuspendProvider,
);

// customer management routes
router.get("/customers", drizzleAuthMiddleware(["admin"]), getAllCustomers);
router.get(
  "/customer/:customerId",
  drizzleAuthMiddleware(["admin"]),
  getCustomerById,
);

// payout management routes
router.get(
  "/payouts/pending",
  drizzleAuthMiddleware(["admin"]),
  getPendingPayouts,
);
router.post(
  "/payouts/initiate/:providerId",
  drizzleAuthMiddleware(["admin"]),
  initiatePayout,
);
router.post(
  "/payouts/process/:payoutId",
  drizzleAuthMiddleware(["admin"]),
  processPayout,
);
router.post(
  "/payouts/complete/:payoutId",
  drizzleAuthMiddleware(["admin"]),
  completePayout,
);
router.post(
  "/payouts/fail/:payoutId",
  drizzleAuthMiddleware(["admin"]),
  failPayout,
);
router.get(
  "/payouts/stats",
  drizzleAuthMiddleware(["admin"]),
  getPayoutStats,
);
router.get(
  "/payouts",
  drizzleAuthMiddleware(["admin"]),
  getAllPayouts,
);
router.get(
  "/payouts/:payoutId",
  drizzleAuthMiddleware(["admin"]),
  getPayoutById,
);
router.post(
  "/payouts/bulk-initiate",
  drizzleAuthMiddleware(["admin"]),
  bulkInitiatePayouts,
);
router.get(
  "/payouts/provider/:providerId/summary",
  drizzleAuthMiddleware(["admin"]),
  getProviderPayoutSummary,
);

// Bank account management routes (admin)
router.get(
  "/bank-accounts",
  drizzleAuthMiddleware(["admin"]),
  getAllBankAccounts,
);
router.patch(
  "/bank-accounts/:bankAccountId/verify",
  drizzleAuthMiddleware(["admin"]),
  verifyBankAccount,
);

export default router;
