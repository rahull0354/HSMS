import {
  createReview,
  getMyReviews,
  getProviderReviews,
  respondToReview,
  updateReview,
} from "#controllers/reviews.controller.js";
import { authMiddleware } from "#middlewares/auth.middleware.js";
import express from "express";

const router = express.Router();

router.get("/provider/:providerId", getProviderReviews);

// middleware protected routes
router.post("/create/:requestId", authMiddleware(["customer"]), createReview);
router.get("/customer/my-reviews", authMiddleware(["customer"]), getMyReviews);
router.patch(
  "/provider/respond/:reviewId",
  authMiddleware(["serviceProvider"]),
  respondToReview,
);
router.patch(
  "/customer/edit-review/:reviewId",
  authMiddleware(["customer"]),
  updateReview,
);

export default router;
