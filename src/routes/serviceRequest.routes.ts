import {
  acceptRequest,
  cancelServiceRequest,
  createServiceRequest,
  getAvailableRequests,
  getMyServiceRequests,
  getRequestById,
  rescheduleServiceRequest,
} from "#controllers/serviceRequest.controller.js";
import { authMiddleware } from "#middlewares/auth.middleware.js";
import express from "express";

const router = express.Router();

router.post("/create", authMiddleware(["customer"]), createServiceRequest);
router.get(
  "/requests/my-services",
  authMiddleware(["customer"]),
  getMyServiceRequests,
);
router.get(
  "/requests/available-requests",
  authMiddleware(["serviceProvider"]),
  getAvailableRequests,
);
router.post(
  "/requests/accept/:requestId",
  authMiddleware(["serviceProvider"]),
  acceptRequest,
);
router.patch(
  "/requests/cancel/:requestId",
  authMiddleware(["customer"]),
  cancelServiceRequest,
);
router.patch(
  "/requests/reschedule/:requestId",
  authMiddleware(["customer"]),
  rescheduleServiceRequest,
);

router.get(
  "/requests/:requestId",
  authMiddleware(["customer"]),
  getRequestById,
);

export default router;
