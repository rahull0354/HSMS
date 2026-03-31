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

export default router;
