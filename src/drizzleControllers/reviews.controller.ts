import { customerRepository } from "#db/repositories/customer.repository.js";
import { reviewsRepository } from "#db/repositories/reviews.repository.js";
import { serviceProviderRepository } from "#db/repositories/serviceProvider.repository.js";
import { serviceRequestRepository } from "#db/repositories/serviceRequests.repository.js";
import { reviews } from "#db/schema.js";
import { handleReviewResponseNotification } from "#services/notification.service.js";
import { Request, Response } from "express";

// customer functions

export const createReview = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user.id;
    const { requestId } = req.params;
    const requestIdValue = Array.isArray(requestId) ? requestId[0] : requestId;
    const { rating, comment, detailedRatings } = req.body;

    if (!requestId) {
      res.status(400).json({
        message: "Request Id is required",
        success: false,
      });
      return;
    }

    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({
        message: "Rating is required and must be between 1 & 5",
        success: false,
      });
      return;
    }

    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      res.status(404).json({
        message: "Customer Not Found",
        success: false,
      });
      return;
    }

    if (!customer.isActive) {
      res.status(403).json({
        message:
          "Your account is deactivated. Please reactivate to submit reviews.",
        success: false,
      });
      return;
    }

    // Use the new function to verify service request belongs to customer
    const serviceRequest =
      await serviceRequestRepository.findByRequestIdAndCustomerId(
        requestIdValue,
        customerId,
      );

    if (!serviceRequest) {
      res.status(404).json({
        message: "Service Request not Found",
        success: false,
      });
      return;
    }

    if (serviceRequest.status !== "completed") {
      res.status(400).json({
        message: "Can only review completed services",
        success: false,
      });
      return;
    }

    // Check if review already exists
    const existingReview =
      await reviewsRepository.findByRequestId(requestIdValue);

    if (existingReview) {
      res.status(400).json({
        message: "You have already reviewed this service request.",
        success: false,
      });
      return;
    }

    if (!serviceRequest.serviceProviderId) {
      res.status(400).json({
        message: "Cannot review request - no provider assigned",
        success: false,
      });
      return;
    }

    // Create the review using Drizzle
    const newReview = await reviewsRepository.create({
      serviceRequestId: requestIdValue,
      customerId: customerId,
      serviceProviderId: serviceRequest.serviceProviderId,
      rating: rating,
      comment: comment || "",
      detailedRatings: detailedRatings || {
        punctuality: 0,
        quality: 0,
        behaviour: 0,
        valueForMoney: 0,
      },
    });

    // Update provider's average rating and total reviews
    const provider = await serviceProviderRepository.findById(
      serviceRequest.serviceProviderId,
    );

    let updatedProvider = null;
    if (provider) {
      // Get review stats from repository
      const totalReviews = await reviewsRepository.countByProvider(
        serviceRequest.serviceProviderId,
        false, // count all reviews, including hidden
      );

      const averageRating = await reviewsRepository.getAverageRating(
        serviceRequest.serviceProviderId,
      );

      // Update provider stats
      updatedProvider = await serviceProviderRepository.updateRatingStats(
        serviceRequest.serviceProviderId,
        {
          averageRating: averageRating.toString(),
          totalReviews: totalReviews,
        },
      );
    }

    res.status(201).json({
      message: "Review Created Successfully",
      success: true,
      data: {
        review: newReview,
        provider: updatedProvider
          ? {
              id: updatedProvider.id,
              name: updatedProvider.name,
              newAverageRating: updatedProvider.averageRating,
              totalReviews: updatedProvider.totalReviews,
            }
          : null,
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Creating Review",
      success: false,
    });
    return;
  }
};

export const getMyReviews = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user.id;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const order = (req.query.order as string) || "desc";
    const rating = req.query.rating as string;

    if (!customerId) {
      res.status(400).json({
        message: "Customer Id not found",
        success: false,
      });
      return;
    }

    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      res.status(404).json({
        message: "Customer Not Found",
        success: false,
      });
      return;
    }

    // Parse rating filter
    let ratingFilter;
    if (rating) {
      const ratingNum = parseInt(rating);
      if (ratingNum < 1 || ratingNum > 5) {
        res.status(400).json({
          message: "Rating must be between 1 and 5",
          success: false,
        });
        return;
      }
      ratingFilter = ratingNum;
    }

    // Get reviews from repository
    const result = await reviewsRepository.findByCustomer(
      customerId,
      { page, limit },
      {
        rating: ratingFilter,
        sortBy,
        order: (order as "asc") || "desc",
      },
    );

    // Get rating distribution for this customer
    const allReviews = await reviewsRepository.findByCustomer(
      customerId,
      undefined,
      undefined,
    );

    // Calculate rating distribution manually
    const distribution = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    allReviews.reviews.forEach((review) => {
      distribution[review.rating as keyof typeof distribution]++;
    });

    res.status(200).json({
      message: "Reviews Retrieved Successfully",
      success: true,
      data: {
        customer: {
          id: customer.id,
          name: customer.name,
          totalReviews: result.total,
          ratingDistribution: distribution,
        },
        reviews: result.reviews,
        pagination: {
          currentPage: page,
          totalPages: result.totalPages,
          totalReviews: result.total,
          limit,
          hasNext: page < result.totalPages,
          hasPrev: page > 1,
        },
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching Reviews",
      success: false,
    });
    return;
  }
};

export const updateReview = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user.id;
    const { reviewId } = req.params;
    const reviewIdValue = Array.isArray(reviewId) ? reviewId[0] : reviewId;

    const { rating, comment, detailedRatings } = req.body;

    if (!reviewId) {
      res.status(400).json({
        message: "Review Id is required",
        success: false,
      });
      return;
    }

    if (!rating && !comment && !detailedRatings) {
      res.status(400).json({
        message:
          "At least one field (rating, comment, or detailedRatings) is required",
        success: false,
      });
      return;
    }

    if (rating !== undefined && (rating < 1 || rating > 5)) {
      res.status(400).json({
        message: "Rating must be between 1 & 5",
        success: false,
      });
      return;
    }

    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      res.status(404).json({
        message: "Customer Not Found!",
        success: false,
      });
      return;
    }

    if (!customer.isActive) {
      res.status(403).json({
        message:
          "Your account is deactivated. Please reactivate to update reviews.",
        success: false,
      });
      return;
    }

    const review = await reviewsRepository.findById(reviewIdValue);

    if (!review) {
      res.status(404).json({
        message: "Review Not Found",
        success: false,
      });
      return;
    }

    if (review.customerId !== customerId) {
      res.status(403).json({
        message: "You are not authorized to update this review",
        success: false,
      });
      return;
    }

    // storing old rating for updating provider
    const oldRating = review.rating;

    const updateData: any = {};

    // update review field
    if (rating !== undefined) {
      updateData.rating = rating;
    }

    if (comment !== undefined) {
      updateData.comment = comment;
    }

    if (detailedRatings !== undefined) {
      updateData.detailedRatings = {
        ...(review.detailedRatings as any),
        ...detailedRatings,
      };
    }

    const updatedReview = await reviewsRepository.update(
      reviewIdValue,
      updateData,
    );

    if (rating !== undefined && rating !== oldRating) {
      const averageRating = await reviewsRepository.getAverageRating(
        review.serviceProviderId,
      );
      const totalReviews = await reviewsRepository.countByProvider(
        review.serviceProviderId,
        false,
      );

      await serviceProviderRepository.updateRatingStats(
        review.serviceProviderId,
        {
          averageRating: averageRating.toString(),
          totalReviews,
        },
      );
    }

    res.status(200).json({
      message: "Review Updated Successfully.",
      success: true,
      data: {
        review: updatedReview,
        changes: {
          ratingChanged: rating !== undefined && rating !== oldRating,
          oldRating,
          newRating: updatedReview?.rating,
        },
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Updating the Review",
      success: false,
    });
    return;
  }
};

export const deleteReview = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user.id;
    const { reviewId } = req.params;
    const reviewIdValue = Array.isArray(reviewId) ? reviewId[0] : reviewId;

    if (!reviewId) {
      res.status(400).json({
        message: "Review ID is required",
        success: false,
      });
      return;
    }

    const customer = await customerRepository.findById(customerId);
    if (!customer || !customer.isActive) {
      res.status(customer ? 403 : 404).json({
        message: customer ? "Account deactivated." : "Customer Not Found",
        success: false,
      });
      return;
    }

    const review = await reviewsRepository.findById(reviewIdValue);

    if (!review) {
      res.status(404).json({
        message: "Review Not Found",
        success: false,
      });
      return;
    }

    // check if review belongs to this customer
    if (review.customerId !== customerId) {
      res.status(403).json({
        message: "You are not authorized to delete this review",
        success: false,
      });
      return;
    }

    // store provider ID before deleting
    const providerId = review.serviceProviderId;
    await reviewsRepository.delete(reviewIdValue);

    // update provider's average rating and total reviews
    const averageRating = await reviewsRepository.getAverageRating(providerId);
    const totalReviews = await reviewsRepository.countByProvider(
      providerId,
      false,
    );

    await serviceProviderRepository.updateRatingStats(providerId, {
      averageRating: averageRating.toString(),
      totalReviews,
    });

    res.status(200).json({
      message: "Review Deleted Successfully",
      success: true,
      data: {
        deleteReviewId: reviewId,
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Deleting Review",
      success: false,
    });
    return;
  }
};

// provider functions

export const respondToReview = async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).user.id;
    const { reviewId } = req.params;
    const reviewIdValue = Array.isArray(reviewId) ? reviewId[0] : reviewId;
    const { comment } = req.body;

    if (!reviewId) {
      res.status(400).json({
        message: "Review Id is required",
        success: false,
      });
      return;
    }

    if (!comment && comment.trim().length === 0) {
      res.status(400).json({
        message: "Comment is required.",
        success: false,
      });
      return;
    }

    const provider = await serviceProviderRepository.findById(providerId);
    if (!provider || !provider.isActive || provider.isSuspended) {
      res.status(403).json({
        message: !provider
          ? "Provider Not Found"
          : provider.isSuspended
            ? `Account suspended. Reason: ${provider.suspensionReason}`
            : "Account deactivated.",
        success: false,
      });
      return;
    }

    // finding the review
    const review = await reviewsRepository.findById(reviewIdValue);

    if (!review) {
      res.status(404).json({
        message: "Review Not Found",
        success: false,
      });
      return;
    }

    if (review.serviceProviderId !== providerId) {
      res.status(403).json({
        message: "You are not authorized to respond to this review",
        success: false,
      });
      return;
    }

    if (review.providerResponse?.comment) {
      res.status(400).json({
        message: "You have already responded to the review.",
        success: false,
      });
      return;
    }

    // update the review with providers response
    const updatedReview = await reviewsRepository.addProviderResponse(
      reviewIdValue,
      comment.trim(),
    );

    const customer = await customerRepository.findById(review.customerId);
    let notificationSent = false

    if (customer) {
      const notificationResult = await handleReviewResponseNotification(
        customer.id,
        customer.name,
        provider.id,
        provider.name,
        review.id,
        comment.trim(),
      );
      notificationSent = notificationResult.success
    }

    res.status(200).json({
      message: "Response Added Successfully.",
      success: true,
      data: {
        review: {
          id: updatedReview?.id,
          providerResponse: updatedReview?.providerResponse,
        },
        customer: customer ? {
          name: customer.name,
          notified: notificationSent
        } : null,
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Responding to Review",
      success: false,
    });
    return;
  }
};

export const getReviewsAboutMe = async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).user.id;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const order = (req.query.order as string) || "desc";
    const rating = req.query.rating
      ? parseInt(req.query.rating as string)
      : undefined;

    const provider = await serviceProviderRepository.findById(providerId);
    if (!provider) {
      res.status(404).json({
        message: "Service Provider Not Found",
        success: false,
      });
      return;
    }

    if (rating && (rating < 1 || rating > 5)) {
      res
        .status(400)
        .json({ message: "Rating must be between 1 and 5", success: false });
      return;
    }

    const result = await reviewsRepository.findByProvider(
      providerId,
      { page, limit },
      { rating, sortBy, order: (order as "asc") || "desc" },
    );

    const stats = await reviewsRepository.getProviderStats(providerId);

    res.status(200).json({
      message: `Reviews for ${provider.name}`,
      success: true,
      data: {
        provider: {
          id: provider.id,
          name: provider.name,
          averageRating: provider.averageRating,
          ratingDistribution: stats.ratingDistribution,
        },
        reviews: result.reviews,
        pagination: {
          currentPage: page,
          totalPages: result.totalPages,
          totalReviews: result.total,
          limit,
          hasNext: page < result.totalPages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching Reviews About Me",
      success: false,
    });
    return;
  }
};

// admin functions

export const flagCustomerReview = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.id;
    const { reviewId } = req.params;
    const reviewIdValue = Array.isArray(reviewId) ? reviewId[0] : reviewId;
    const { reason, hideReview } = req.body;

    if (!reviewId) {
      res.status(400).json({
        message: "Review Id is required",
        success: false,
      });
      return;
    }

    const review = await reviewsRepository.findById(reviewIdValue);

    if (!review) {
      res.status(404).json({
        message: "Review not found!",
        success: false,
      });
      return;
    }

    if (review.isFlagged) {
      res.status(400).json({
        message: "Review is already Flagged",
        success: false,
      });
      return;
    }

    const updatedReview = await reviewsRepository.flagReview(
      reviewIdValue,
      reason,
      hideReview,
    );

    res.status(200).json({
      message: "Review Flagged Successfully!",
      success: true,
      data: {
        review: {
          id: updatedReview?.id,
          isFlagged: updatedReview?.isFlagged,
          isVisible: updatedReview?.isVisible,
          flagReason: reason || "Not Specified",
        },
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Flagging the Review",
      success: false,
    });
    return;
  }
};

export const unFlagCustomerReview = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const reviewIdValue = Array.isArray(reviewId) ? reviewId[0] : reviewId;

    if (!reviewId) {
      res.status(400).json({
        message: "Review Id is required.",
        success: false,
      });
      return;
    }

    const review = await reviewsRepository.findById(reviewIdValue);
    if (!review) {
      res.status(404).json({
        message: "Review not found !",
        success: false,
      });
      return;
    }

    if (!review.isFlagged) {
      res.status(400).json({
        message: "Review is not flagged.",
        success: false,
      });
      return;
    }

    const updatedReview = await reviewsRepository.unflagReview(reviewIdValue);

    res.status(200).json({
      message: "Review Un-Flagged Successfully!",
      success: true,
      data: {
        review: {
          id: updatedReview?.id,
          isFlagged: updatedReview?.isFlagged,
          isVisible: updatedReview?.isVisible,
        },
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Un-Flagging the Review",
      success: false,
    });
    return;
  }
};

export const toggleReviewVisibility = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const reviewIdValue = Array.isArray(reviewId) ? reviewId[0] : reviewId;
    const { isVisible } = req.body;

    if (!reviewId) {
      res.status(400).json({
        message: "Review Id is required!",
        success: false,
      });
      return;
    }

    const updatedReview = await reviewsRepository.toggleVisibility(
      reviewIdValue,
      isVisible,
    );

    if (!updatedReview) {
      res.status(404).json({
        message: "Review not found !",
        success: false,
      });
      return;
    }

    res.status(200).json({
      message: `Review ${updatedReview?.isVisible ? "Visible" : "Hidden"} Successfully !`,
      success: true,
      data: {
        review: {
          id: updatedReview?.id,
          isVisible: updatedReview?.isVisible,
          isFlagged: updatedReview?.isFlagged,
        },
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Toggling the visibility of Review",
      success: false,
    });
    return;
  }
};

export const getAllReviews = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.id;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const order = (req.query.order as string) || "desc";

    const rating = req.query.rating
      ? parseInt(req.query.rating as string)
      : undefined;
    const isFlagged =
      req.query.isFlagged === "true"
        ? true
        : req.query.isFlagged === "false"
          ? false
          : undefined;
    const isVisible =
      req.query.isVisible === "true"
        ? true
        : req.query.isVisible === "false"
          ? false
          : undefined;

    const result = await reviewsRepository.findAll(
      { page, limit },
      {
        rating,
        isFlagged,
        isVisible,
        sortBy,
        order: (order as "asc") || "desc",
      },
    );

    const stats = await reviewsRepository.getOverallStats();

    res.status(200).json({
      message: "All Reviews Retrieved !",
      success: true,
      data: {
        reviews: result.reviews,
        statistics: {
          totalReviews: stats.totalReviews,
          flaggedReviews: stats.flaggedReviews,
          hiddenReviews: stats.hiddenReviews,
          ratingDistribution: stats.ratingDistribution,
        },
        pagination: {
          currentPage: page,
          totalPages: result.totalPages,
          totalReviews: result.total,
          limit,
          hasNext: page < result.totalPages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching all Reviews",
      success: false,
    });
    return;
  }
};

// // general functions

export const getProviderReviews = async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const providerIdValue = Array.isArray(providerId)
      ? providerId[0]
      : providerId;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const order = (req.query.order as string) || "desc";
    const rating = req.query.rating
      ? parseInt(req.query.rating as string)
      : undefined;

    if (!providerId) {
      res.status(400).json({
        message: "Provider ID is required",
        success: false,
      });
      return;
    }

    const provider = await serviceProviderRepository.findById(providerIdValue);
    if (!provider || !provider.isActive || provider.isSuspended) {
      res.status(404).json({
        message: "Service Provider Not Found or unavailable",
        success: false,
      });
      return;
    }

    if (rating && (rating < 1 || rating > 5)) {
      res.status(400).json({
        message: "Rating must be between 1 & 5",
        success: false,
      });
      return;
    }

    const result = await reviewsRepository.findByProvider(
      providerIdValue,
      { page, limit },
      { rating, sortBy, order: (order as "asc") || "desc" },
    );

    const stats = await reviewsRepository.getProviderStats(providerIdValue);

    res.status(200).json({
      message: "Provider Reviews Retrieved Successfully",
      success: true,
      data: {
        provider: {
          id: provider.id,
          name: provider.name,
          averageRating: provider.averageRating,
          totalReviews: provider.totalReviews,
          ratingDistribution: stats.ratingDistribution,
        },
        reviews: result.reviews,
        pagination: {
          currentPage: page,
          totalPages: result.totalPages,
          totalReviews: result.total,
          limit,
          hasNext: page < result.totalPages,
          hasPrev: page > 1,
        },
      },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching Reviews of provider",
      success: false,
    });
    return;
  }
};

export const getReviewById = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const reviewIdValue = Array.isArray(reviewId) ? reviewId[0] : reviewId;

    if (!reviewId) {
      res.status(400).json({
        message: "Review Id is required",
        success: false,
      });
      return;
    }

    const review = await reviewsRepository.findById(reviewIdValue);

    if (!review) {
      res.status(404).json({
        message: "Review Not Found",
        success: false,
      });
      return;
    }

    if (!review.isVisible) {
      res.status(400).json({
        message: "The review is not available",
        success: false,
      });
      return;
    }

    res.status(200).json({
      message: "Review Retrieved Successfully",
      success: true,
      data: { review },
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Fetching Review By ID",
      success: false,
    });
    return;
  }
};
