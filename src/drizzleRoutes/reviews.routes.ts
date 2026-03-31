import {
  createReview,
  deleteReview,
  flagCustomerReview,
  getAllReviews,
  getMyReviews,
  getProviderReviews,
  getReviewById,
  getReviewDetailsForAdmin,
  getReviewsAboutMe,
  respondToReview,
  toggleReviewVisibility,
  unFlagCustomerReview,
  updateReview,
} from "#drizzleControllers/reviews.controller.js";
import { drizzleAuthMiddleware } from "#middlewares/drizzleAuth.middleware.js";
import express from "express";

const router = express.Router();

// Customer routes
router.post(
  "/create/:requestId",
  drizzleAuthMiddleware(["customer"]),
  createReview,
);
router.get(
  "/customer/my-reviews",
  drizzleAuthMiddleware(["customer"]),
  getMyReviews,
);
router.patch(
  "/customer/edit-review/:reviewId",
  drizzleAuthMiddleware(["customer"]),
  updateReview,
);
router.delete(
  "/customer/delete/:reviewId",
  drizzleAuthMiddleware(["customer"]),
  deleteReview,
);

// Service Provider routes
router.get(
  "/provider/my-reviews",
  drizzleAuthMiddleware(["serviceProvider"]),
  getReviewsAboutMe,
);
router.patch(
  "/provider/respond/:reviewId",
  drizzleAuthMiddleware(["serviceProvider"]),
  respondToReview,
);

// admin routes
router.patch(
  "/admin/flag/:reviewId",
  drizzleAuthMiddleware(["admin"]),
  flagCustomerReview,
);
router.patch(
  "/admin/un-flag/:reviewId",
  drizzleAuthMiddleware(["admin"]),
  unFlagCustomerReview,
);
router.patch(
  "/admin/visibility/:reviewId",
  drizzleAuthMiddleware(["admin"]),
  toggleReviewVisibility,
);
router.get(
  "/admin/all-reviews",
  drizzleAuthMiddleware(["admin"]),
  getAllReviews,
);
router.get(
  "/admin/:reviewId",
  drizzleAuthMiddleware(["admin"]),
  getReviewDetailsForAdmin,
);

// Public routes
router.get("/provider/:providerId", getProviderReviews);
router.get("/general/:reviewId", getReviewById);

export default router;
