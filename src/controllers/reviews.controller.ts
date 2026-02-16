import Customer from "#models/customer.model.js";
import Reviews from "#models/reviews.model.js";
import ServiceProvider from "#models/serviceProvider.model.js";
import ServiceRequests from "#models/serviceRequests.model.js";
import { handleReviewResponseNotification } from "#services/notification.service.js";
import { Request, Response } from "express";

export const createReview = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user.id;
    const { requestId } = req.params;
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

    const customer = await Customer.findById(customerId);
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

    const serviceRequest = await ServiceRequests.findOne({
      _id: requestId,
      customerId: customerId,
    });

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

    const existingReview = await Reviews.findOne({
      serviceRequestId: requestId as any,
    });

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

    const newReview = new Reviews({
      serviceRequestId: requestId,
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

    await newReview.save();

    // updating providers average rating and total reviews
    const provider = await ServiceProvider.findById(
      serviceRequest.serviceProviderId,
    );

    if (provider) {
      const totalReviewsCount = await Reviews.countDocuments({
        serviceProviderId: provider._id as any,
      });

      const allReviews = await Reviews.find({
        serviceProviderId: provider._id as any,
      });

      const totalRating = allReviews.reduce(
        (sum, review) => sum + review.rating,
        0,
      );

      const averageRating = totalRating / totalReviewsCount;

      provider.averageRating = parseFloat(averageRating.toFixed(2));
      provider.totalReviews = totalReviewsCount;
      await provider.save();
    }

    res.status(201).json({
      message: "Review Created Successfully",
      success: true,
      data: {
        review: newReview,
        provider: {
          name: provider?.name,
          newAverageRating: provider?.averageRating,
          totalReviews: provider?.totalReviews,
        },
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

export const getProviderReviews = async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const order = (req.query.order as string) || "desc";
    const rating = req.query.rating as string;

    if (!providerId) {
      res.status(400).json({
        message: "Provider ID is required",
        success: false,
      });
      return;
    }

    const provider = await ServiceProvider.findById(providerId);
    if (!provider) {
      res.status(404).json({
        message: "Service Provider Not Found",
        success: false,
      });
      return;
    }

    // build filter object
    const filter: any = {
      serviceProviderId: providerId,
      isVisible: true,
    };

    // filter by rating
    if (rating) {
      const ratingNum = parseInt(rating);
      if (ratingNum < 1 || ratingNum > 5) {
        res.status(400).json({
          message: "Rating must be between 1 & 5",
          success: false,
        });
        return;
      }
      filter.rating = ratingNum;
    }

    // build sort obj
    const validSortFields = ["createdAt", "rating", "updatedAt"];
    const sortObj: any = {};

    if (validSortFields.includes(sortBy)) {
      sortObj[sortBy] = order === "asc" ? 1 : -1;
    } else {
      sortObj.createdAt = -1; // default sort
    }

    const reviews = await Reviews.find(filter)
      .populate("customerId", "name profilePicture")
      .populate("serviceRequestId", "serviceTitle serviceAddress")
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    const totalReviews = await Reviews.countDocuments(filter);

    const ratingDistribution = await Reviews.aggregate([
      {
        $match: { serviceProviderId: provider._id, isVisible: true },
      },
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
    ]);

    const distribution = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    ratingDistribution.forEach((item: any) => {
      distribution[item._id as keyof typeof distribution] = item.count;
    });

    res.status(200).json({
      message: "Provider Reviews Retrieved Successfully",
      success: true,
      data: {
        provider: {
          id: provider._id,
          name: provider.name,
          averageRating: provider.averageRating,
          totalReviews: provider.totalReviews,
          ratingDistribution: distribution,
        },
        reviews: reviews,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalReviews / limit),
          totalReviews,
          limit,
          hasNext: page < Math.ceil(totalReviews / limit),
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

export const getMyReviews = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user.id;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
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

    const customer = await Customer.findById(customerId);
    if (!customer) {
      res.status(404).json({
        message: "Customer Not Found",
        success: false,
      });
      return;
    }

    // build filter object
    const filter: any = {
      customerId: customerId,
    };

    // filter by rating
    if (rating) {
      const ratingNum = parseInt(rating);
      if (ratingNum < 1 || ratingNum > 5) {
        res.status(400).json({
          message: "Rating must be between 1 and 5",
          success: false,
        });
        return;
      }
      filter.rating = ratingNum;
    }

    // build sort object
    const validSortFields = ["createdAt", "rating", "updatedAt"];
    const sortObj: any = {};

    if (validSortFields.includes(sortBy)) {
      sortObj[sortBy] = order === "asc" ? 1 : -1;
    } else {
      sortObj.createdAt = -1;
    }

    const reviews = await Reviews.find(filter)
      .populate("serviceProviderId", "name email profilePicture")
      .populate("serviceRequestId", "serviceTitle serviceAddress")
      .skip(skip)
      .sort(sortObj)
      .limit(limit);

    const totalReviews = await Reviews.countDocuments(filter);

    const ratingDistribution = await Reviews.aggregate([
      {
        $match: { customerId: customer._id },
      },
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
    ]);

    const distribution = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    ratingDistribution.forEach((item: any) => {
      distribution[item._id as keyof typeof distribution] = item.count;
    });

    res.status(200).json({
      message: "Reviews Retrieved Successfully",
      success: true,
      data: {
        customer: {
          id: customer._id,
          name: customer.name,
          totalReviews: totalReviews,
          ratingDistribution: distribution,
        },
        reviews: reviews,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalReviews / limit),
          totalReviews,
          limit,
          hasNext: page < Math.ceil(totalReviews / limit),
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

    const customer = await Customer.findById(customerId);
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

    const review = await Reviews.findById(reviewId);

    if (!review) {
      res.status(404).json({
        message: "Review Not Found",
        success: false,
      });
      return;
    }

    if (review.customerId.toString() !== customerId) {
      res.status(403).json({
        message: "You are not authorized to update this review",
        success: false,
      });
      return;
    }

    // storing old rating for updating provider
    const oldRating = review.rating;
    const oldReview = { ...review.toObject() };

    // update review field
    if (rating !== undefined) {
      review.rating = rating;
    }

    if (comment !== undefined) {
      review.comment = comment;
    }

    if (detailedRatings !== undefined) {
      review.detailedRatings = {
        ...review.detailedRatings,
        ...detailedRatings,
      };
    }

    await review.save();

    if (rating !== undefined && rating !== oldRating) {
      const provider = await ServiceProvider.findById(review.serviceProviderId);

      if (provider) {
        const allReviews = await Reviews.find({
          serviceProviderId: provider._id as any,
        });

        const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
        const averageRating = totalRating / allReviews.length;

        provider.averageRating = parseFloat(averageRating.toFixed(2));
        await provider.save();
      }
    }

    res.status(200).json({
      message: "Review Updated Successfully.",
      success: true,
      data: {
        review: review,
        changes: {
          ratingChanged: rating !== undefined && rating !== oldRating,
          oldRating: oldRating,
          newRating: review.rating,
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

    if (!reviewId) {
      res.status(400).json({
        message: "Review ID is required",
        success: false,
      });
      return;
    }

    const customer = await Customer.findById(customerId);
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
          "Your account is deactivated. Please reactivate to delete reviews.",
        success: false,
      });
      return;
    }

    const review = await Reviews.findById(reviewId);

    if (!review) {
      res.status(404).json({
        message: "Review Not Found",
        success: false,
      });
      return;
    }

    // check if review belongs to this customer
    if (review.customerId.toString() !== customerId) {
      res.status(403).json({
        message: "You are not authorized to delete this review",
        success: false,
      });
      return;
    }

    // store provider ID before deleting
    const providerId = review.serviceProviderId;

    // delete the review
    await Reviews.findByIdAndDelete(reviewId);

    // update provider's average rating and total reviews
    const provider = await ServiceProvider.findById(providerId);

    if (provider) {
      const allReviews = await Reviews.find({
        serviceProviderId: provider._id as any,
      });

      if (allReviews.length > 0) {
        const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
        const averageRating = totalRating / allReviews.length;

        provider.averageRating = parseFloat(averageRating.toFixed(2));
        provider.totalReviews = allReviews.length;
      } else {
        // no reviews left
        provider.averageRating = 0;
        provider.totalReviews = 0;
      }

      await provider.save();
    }

    res.status(200).json({
      message: "Review Deleted Successfully",
      success: true,
      data: {
        deletedReviewId: reviewId,
        provider: provider
          ? {
              name: provider.name,
              updatedAverageRating: provider.averageRating,
              totalReviews: provider.totalReviews,
            }
          : null,
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
    const { comment } = req.body;

    if (!reviewId) {
      res.status(400).json({
        message: "Review Id is required",
        success: false,
      });
      return;
    }

    if (!comment || comment.trim().length === 0) {
      res.status(400).json({
        message: "Comment is required.",
        success: false,
      });
      return;
    }

    const provider = await ServiceProvider.findById(providerId);
    if (!provider) {
      res.status(404).json({
        message: "Service Provider Not Found",
        success: false,
      });
      return;
    }

    if (!provider.isActive) {
      res.status(403).json({
        message:
          "Your account is deactivated. Please reactivate to respond to reviews.",
        success: false,
      });
      return;
    }

    if (provider.isSuspended) {
      res.status(403).json({
        message: `Your account is suspended. Reason: ${provider.suspensionReason || "Contact support for details."}`,
        success: false,
      });
      return;
    }

    // finding the review
    const review = await Reviews.findById(reviewId).populate(
      "customerId",
      "name email",
    );

    if (!review) {
      res.status(404).json({
        message: "Review Not Found",
        success: false,
      });
      return;
    }

    if (review.serviceProviderId.toString() !== providerId) {
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
    review.providerResponse = {
      comment: comment.trim(),
      respondedAt: new Date(),
    };

    await review.save();

    const customer = review.customerId as any;

    const notificationResult = await handleReviewResponseNotification(
      customer._id,
      customer.name,
      provider._id as any,
      provider.name,
      review._id as any,
      review.providerResponse?.comment || comment.trim(),
    );

    res.status(200).json({
      message: "Response Added Successfully.",
      success: true,
      data: {
        review: {
          _id: review._id,
          providerResponse: review.providerResponse,
        },
        customer: {
          name: customer.name,
          notified: notificationResult.success,
        },
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
    const rating = req.query.rating as string;

    const provider = await ServiceProvider.findById(providerId);
    if (!provider) {
      res.status(404).json({
        message: "Service Provider Not Found",
        success: false,
      });
      return;
    }

    const filter: any = {
      serviceProviderId: providerId,
      isVisible: true,
    };

    if (rating) {
      const ratingNum = parseInt(rating);
      if (ratingNum < 1 || ratingNum > 5) {
        res.status(400).json({
          message: "Rating must be between 1 and 5",
          success: false,
        });
        return;
      }
      filter.rating = ratingNum;
    }

    // build sort object
    const validSortFields = ["createdAt", "rating", "updatedAt"];
    const sortObj: any = {};

    if (validSortFields.includes(sortBy)) {
      sortObj[sortBy] = order === "asc" ? 1 : -1;
    } else {
      sortObj.createdAt = -1;
    }

    // fetch reviews
    const reviews = await Reviews.find(filter)
      .populate("customerId", "name profilePicture")
      .populate("serviceRequestId", "serviceTitle")
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    const totalReviews = await Reviews.countDocuments(filter);

    // calculate rating distribution
    const ratingDistribution = await Reviews.aggregate([
      {
        $match: { serviceProviderId: provider._id, isVisible: true },
      },
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
    ]);

    const distribution = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    ratingDistribution.forEach((item: any) => {
      distribution[item._id as keyof typeof distribution] = item.count;
    });

    res.status(200).json({
      message: "Reviews About Me Retrieved Successfully",
      success: true,
      data: {
        provider: {
          id: provider._id,
          name: provider.name,
          averageRating: provider.averageRating,
          totalReviews: provider.totalReviews,
          ratingDistribution: distribution,
        },
        reviews: reviews,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalReviews / limit),
          totalReviews,
          limit,
          hasNext: page < Math.ceil(totalReviews / limit),
          hasPrev: page > 1,
        },
      },
    });
    return;
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
    const { reason, hideReview } = req.body;

    if (!reviewId) {
      res.status(400).json({
        message: "Review Id is required",
        success: false,
      });
      return;
    }

    const review = await Reviews.findById(reviewId);

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

    // flagging the review
    review.isFlagged = true;
    review.flagReason = reason;

    // hiding the review when flagged
    if (hideReview === true) {
      review.isVisible = false;
    }

    await review.save();

    res.status(200).json({
      message: "Review Flagged Successfully!",
      success: true,
      data: {
        review: {
          _id: review._id,
          isFlagged: review.isFlagged,
          isVisible: review.isVisible,
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
    const adminId = (req as any).user.id;
    const { reviewId } = req.params;

    if (!reviewId) {
      res.status(400).json({
        message: "Review Id is required.",
        success: false,
      });
      return;
    }

    const review = await Reviews.findById(reviewId);
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

    review.isFlagged = false;
    review.isVisible = true;
    review.flagReason = undefined;

    await review.save();

    res.status(200).json({
      message: "Review Un-Flagged Successfully!",
      success: true,
      data: {
        review: {
          _id: review._id,
          isFlagged: review.isFlagged,
          isVisible: review.isVisible,
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
    const adminId = (req as any).user.id
    const {reviewId} = req.params
    const {isVisible} = req.body

    if(!reviewId) {
        res.status(400).json({
            message: "Review Id is required!",
            success: false
        })
        return
    }

    const review = await Reviews.findById(reviewId)

    if(!review) {
        res.status(404).json({
            message: "Review not found !",
            success: false
        })
        return
    }

    if(isVisible !== undefined) {
        review.isVisible = isVisible
    } else {
        review.isVisible = !review.isVisible
    }

    await review.save()

    res.status(200).json({
        message: `Review ${review.isVisible ? "Visible" : "Hidden"} Successfully !`,
        success: true,
        data: {
            review: {
                _id: review._id,
                isVisible: review.isVisible,
                isFlagged: review.isFlagged
            },
        }
    })
    return
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error Toggling the visibility of Review",
      success: false,
    });
    return;
  }
};
