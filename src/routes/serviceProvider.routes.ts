import {
  deactivateAccount,
  loginServiceProvider,
  registerServiceProvider,
  requestReactivation,
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

export default router;
