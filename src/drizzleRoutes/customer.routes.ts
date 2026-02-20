import express from "express";
import {
  deactivateAccount,
  loginCustomer,
  registerCustomer,
  requestReactivation,
  updateCustomerDetails,
  verifyAndReactivateAccount,
} from "../drizzleControllers/customer.controller.js";
import { drizzleAuthMiddleware } from "#middlewares/drizzleAuth.middleware.js";

const router = express.Router();

router.post("/register", registerCustomer);
router.post("/login", loginCustomer);
router.post(
  "/request-reactivation",
  requestReactivation,
);
router.get(
  "/reactivate-account/:token",
  verifyAndReactivateAccount,
);

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



export default router;
