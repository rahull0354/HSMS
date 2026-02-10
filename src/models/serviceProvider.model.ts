import mongoose, { Document, Model } from "mongoose";

interface IServiceProvider extends Document {
  name: string;
  email: string;
  phone: string;
  password: string;
  profilePicture: String;
  bio: String;
  skills: string[];
  experienceYears: Number;
  certifications?: Array<{
    name: String;
    issuedBy: String;
    year: Number;
    certificateUrl: String;
  }>;
  pricingType?: String;
  availabilityStatus: String;
  workingHours: {
    from: String;
    to: String;
    daysOff: [String];
  };
  serviceArea: {
    cities: [String];
    areas: [String];
  };
  averageRating: Number;
  totalReviews: Number;
  totalJobsCompleted: Number;
  isActive: Boolean;
  isSuspended: Boolean;
  suspensionReason?: String;
  lastLogin: Date;
}

const serviceProviderSchema = new mongoose.Schema<IServiceProvider>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    profilePicture: String,
    bio: String,
    skills: [
      {
        type: String,
      },
    ],
    experienceYears: {
      type: Number,
      default: 0,
    },
    certifications: [
      {
        name: {
          type: String,
          required: true,
        },
        issuedBy: {
          type: String,
          required: true,
        },
        year: {
          type: Number,
          required: true,
        },
        certificateUrl: {
          type: String,
        },
      },
    ],
    pricingType: {
      type: String,
      enum: ["hourly", "fixed", "per-job", "per-visit", "quote"],
      default: "per-visit",
    },
    availabilityStatus: {
      type: String,
      enum: ["available", "busy", "offline"],
      default: "available",
    },
    workingHours: {
      from: { type: String },
      to: { type: String },
      daysOff: [String],
    },
    serviceArea: {
      cities: [String],
      areas: [String],
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    totalJobsCompleted: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isSuspended: {
      type: Boolean,
      default: false,
    },
    suspensionReason: String,
    lastLogin: Date,
  },
  { timestamps: true },
);

const ServiceProvider: Model<IServiceProvider> =
  mongoose.model<IServiceProvider>("ServiceProvider", serviceProviderSchema);

export default ServiceProvider;
