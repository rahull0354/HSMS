import mongoose, { Document, Model } from "mongoose";

interface IReviews extends Document {
  serviceRequestId: mongoose.Schema.Types.ObjectId;
  customerId: mongoose.Schema.Types.ObjectId;
  serviceProviderId: mongoose.Schema.Types.ObjectId;
  rating: number;
  comment: string;
  detailedRatings: {
    punctuality: number;
    quality: number;
    behaviour: number;
    valueForMoney: number;
  };
  providerResponse: {
    comment: string;
    respondedAt: Date;
  };
  isVisible: boolean;
  isFlagged: boolean;
}

const reviewsSchema = new mongoose.Schema<IReviews>({
  serviceRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServiceRequests",
    required: true,
    unique: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true,
  },
  serviceProviderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServiceProvider",
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: String,
  detailedRatings: {
    punctuality: {
      type: Number,
      min: 1,
      max: 5,
    },
    quality: {
      type: Number,
      min: 1,
      max: 5,
    },
    behaviour: {
      type: Number,
      min: 1,
      max: 5,
    },
    valueForMoney: {
      type: Number,
      min: 1,
      max: 5,
    },
  },
  providerResponse: {
    comment: String,
    respondedAt: Date
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  isFlagged: {
    type: Boolean,
    default: false
  }
}, {timestamps: true});

const Reviews: Model<IReviews> = mongoose.model<IReviews>(
    "Reviews",
    reviewsSchema
)

export default Reviews