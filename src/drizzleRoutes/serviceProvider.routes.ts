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

// Dashboard charts endpoints
router.get("/dashboard/monthly-earnings", drizzleAuthMiddleware(["serviceProvider"]), getMonthlyEarnings);
router.get("/dashboard/monthly-performance", drizzleAuthMiddleware(["serviceProvider"]), getMonthlyPerformance);

export default router;
