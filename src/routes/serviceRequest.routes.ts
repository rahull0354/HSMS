import {
  cancelServiceRequest,
  createServiceRequest,
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
  "/requests/:requestId",
  authMiddleware(["customer"]),
  getRequestById,
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

export default router;
