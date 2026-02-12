import mongoose, { Document, Model } from "mongoose";

interface IServiceRequests extends Document {
  customerId: mongoose.Schema.Types.ObjectId;
  serviceProviderId?: mongoose.Schema.Types.ObjectId;
  serviceType: string;
  serviceCategoryId: mongoose.Schema.Types.ObjectId;
  serviceTitle: string;
  serviceDescription: string;
  schedule: {
    date: Date;
    timeSlot: String;
    preferredTime: String;
  };
  serviceAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    landmarks: string;
  };
  beforeImages: string[];
  afterImages: string[];
  estimatedPrice: number;
  finalPrice: number;
  pricingDetails: {
    baseCharge: number;
    additionalCharge: number;
    breakdown: string;
  };
  paymentStatus: string;
  paymentMethod: string;
  status: string;
  statusHistory: [
    {
      status: string;
      timeStamp: Date;
      note: string;
      updatedBy: string;
    },
  ];
  cancellationReason: string;
  cancelledBy: string;
  cancelledAt: Date;
  isRecurring: boolean;
  recurringPattern: {
    frequency: string;
    endDate: Date;
    nextServiceDate: Date;
  };
  parentRequestId?: mongoose.Schema.Types.ObjectId;
  completedAt: Date;
}

const serviceRequestsSchema = new mongoose.Schema<IServiceRequests>(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    serviceProviderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceProvider",
    },
    serviceType: {
      type: String,
      required: true,
    },
    serviceCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceCategories",
      required: true,
    },
    serviceTitle: {
      type: String,
      required: true,
    },
    serviceDescription: {
      type: String,
    },
    schedule: {
      date: {
        type: Date,
        required: true,
      },
      timeSlot: {
        type: String,
        enum: ["morning", "afternoon", "evening"],
        required: true,
      },
      preferredTime: String,
    },
    serviceAddress: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      landmarks: String,
    },
    beforeImages: [String],
    afterImages: [String],
    estimatedPrice: Number,
    finalPrice: Number,
    pricingDetails: {
      baseCharge: {
        type: Number,
      },
      additionalCharge: {
        type: Number,
      },
      breakdown: {
        type: String,
      },
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded"],
      default: "pending",
    },
    paymentMethod: String,
    status: {
      type: String,
      enum: ["requested", "assigned", "in_progress", "completed", "cancelled"],
      default: "requested",
    },
    statusHistory: [
      {
        status: {
          type: String,
        },
        timeStamp: {
          type: Date,
          default: Date.now(),
        },
        note: String,
        updatedBy: {
          type: String,
          enum: ["customer", "service_provider", "system"],
        },
      },
    ],
    cancellationReason: String,
    cancelledBy: {
      type: String,
      enum: ["customer", "service_provider", "system"],
    },
    cancelledAt: Date,
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringPattern: {
      frequency: {
        type: String,
        enum: ["weekly", "biweekly", "monthly"],
      },
      endDate: Date,
      nextServiceDate: Date,
    },
    parentRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceRequests",
    },
    completedAt: Date,
  },
  { timestamps: true },
);

const ServiceRequests: Model<IServiceRequests> =
  mongoose.model<IServiceRequests>("ServiceRequests", serviceRequestsSchema);

export default ServiceRequests;
