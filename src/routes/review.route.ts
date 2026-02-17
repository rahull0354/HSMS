import {
  createReview,
  deleteReview,
  flagCustomerReview,
  getAllReviews,
  getMyReviews,
  getProviderReviews,
  getReviewsAboutMe,
  respondToReview,
  toggleReviewVisibility,
  unFlagCustomerReview,
  updateReview,
} from "#controllers/reviews.controller.js";
import { authMiddleware } from "#middlewares/auth.middleware.js";
import express from "express";

const router = express.Router();

// Customer routes
router.post("/create/:requestId", authMiddleware(["customer"]), createReview);
router.get("/customer/my-reviews", authMiddleware(["customer"]), getMyReviews);
router.patch(
  "/customer/edit-review/:reviewId",
  authMiddleware(["customer"]),
  updateReview,
);
router.delete(
  "/customer/delete/:reviewId",
  authMiddleware(["customer"]),
  deleteReview,
);

// Service Provider routes
router.get(
  "/provider/my-reviews",
  authMiddleware(["serviceProvider"]),
  getReviewsAboutMe,
);
router.patch(
  "/provider/respond/:reviewId",
  authMiddleware(["serviceProvider"]),
  respondToReview,
);

// admin routes
router.patch(
  "/admin/flag/:reviewId",
  authMiddleware(["admin"]),
  flagCustomerReview,
);
router.patch(
  "/admin/un-flag/:reviewId",
  authMiddleware(["admin"]),
  unFlagCustomerReview,
);
router.patch(
  "/admin/visibility/:reviewId",
  authMiddleware(["admin"]),
  toggleReviewVisibility,
);
router.get("/admin/all-reviews", authMiddleware(["admin"]), getAllReviews);

// Public routes
router.get("/provider/:providerId", getProviderReviews);

export default router;
