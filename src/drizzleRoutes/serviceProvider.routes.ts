import {
  deactivateAccount,
  getAllServiceProviders,
  getProfileDetails,
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

export default router;
