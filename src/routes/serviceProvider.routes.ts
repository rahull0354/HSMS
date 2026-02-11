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
} from "#controllers/serviceProvider.controller.js";
import { authMiddleware } from "#middlewares/auth.middleware.js";
import express from "express";

const router = express.Router();

router.post("/register", registerServiceProvider);
router.post("/login", loginServiceProvider);
router.post("/request-reactivation", requestReactivation);
router.get("/reactivate-account/:token", verifyAndReactivateAccount);
router.get('/list', getAllServiceProviders)
router.get("/list/profile/:serviceProviderId", getPublicProfile)
router.get('/list/search', searchProviders)

// middleware protected routes
router.put(
  "/profile",
  authMiddleware(["serviceProvider"]),
  updateServiceProviderDetails,
);
router.post(
  "/deactivate-account",
  authMiddleware(["serviceProvider"]),
  deactivateAccount,
);
router.get("/profile", authMiddleware(["serviceProvider"]), getProfileDetails);
router.put(
  "/toggleAvailability",
  authMiddleware(["serviceProvider"]),
  toggleAvailability,
);

export default router;
