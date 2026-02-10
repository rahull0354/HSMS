import {
  loginServiceProvider,
  registerServiceProvider,
  updateServiceProviderDetails,
} from "#controllers/serviceProvider.controller.js";
import { authMiddleware } from "#middlewares/auth.middleware.js";
import express from "express";

const router = express.Router();

router.post("/register", registerServiceProvider);
router.post("/login", loginServiceProvider);

// middleware protected routes
router.put(
  "/profile",
  authMiddleware(["serviceProvider"]),
  updateServiceProviderDetails,
);

export default router;
