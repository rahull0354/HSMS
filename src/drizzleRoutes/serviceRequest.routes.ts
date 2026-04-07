import {
  acceptRequest,
  cancelServiceRequest,
  completeService,
  createServiceRequest,
  getAvailableRequests,
  getMyAssignedRequests,
  getMyServiceRequests,
  getRequestByIdForCustomer,
  getRequestByIdForProvider,
  providerRescheduleServiceRequest,
  rescheduleServiceRequest,
  startService,
} from "#drizzleControllers/serviceRequests.controller.js";
import { drizzleAuthMiddleware } from "#middlewares/drizzleAuth.middleware.js";
import express from "express";

const router = express.Router();

router.post(
  "/create",
  drizzleAuthMiddleware(["customer"]),
  createServiceRequest,
);
router.get(
  "/requests/my-services",
  drizzleAuthMiddleware(["customer"]),
  getMyServiceRequests,
);
router.get(
  "/available-requests",
  drizzleAuthMiddleware(["serviceProvider"]),
  getAvailableRequests,
);
router.get(
  "/my-assigned-requests",
  drizzleAuthMiddleware(["serviceProvider"]),
  getMyAssignedRequests,
);
router.patch(
  "/start/:requestId",
  drizzleAuthMiddleware(["serviceProvider"]),
  startService,
);
router.patch(
  "/complete/:requestId",
  drizzleAuthMiddleware(["serviceProvider"]),
  completeService,
);
router.post(
  "/accept/:requestId",
  drizzleAuthMiddleware(["serviceProvider"]),
  acceptRequest,
);
router.patch(
  "/cancel/:requestId",
  drizzleAuthMiddleware(["customer"]),
  cancelServiceRequest,
);
router.patch(
  "/reschedule/:requestId",
  drizzleAuthMiddleware(["customer"]),
  rescheduleServiceRequest,
);
router.post(
  "/provider/reschedule/:requestId",
  drizzleAuthMiddleware(["serviceProvider"]),
  providerRescheduleServiceRequest,
);

router.get(
  "/customer/service-request/:requestId",
  drizzleAuthMiddleware(["customer", "admin"]),
  getRequestByIdForCustomer,
);

router.get(
  "/provider/service-request/:requestId",
  drizzleAuthMiddleware(["serviceProvider"]),
  getRequestByIdForProvider,
);

export default router;
