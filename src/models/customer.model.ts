import mongoose, { Schema, Model } from "mongoose";

interface ICustomer {
  name: string;
  email: string;
  phone?: string;
  password: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    landmarks?: string;
  };
  profilePicture?: string;
  isActive: boolean;
  lastLogin?: Date;
  deactivatedAt?: Date;
  reactivationToken?: string;
  reactivationExpires?: Date;
}

const customerSchema = new Schema<ICustomer>(
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
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      landmarks: String,
    },
    profilePicture: String,
    isActive: {
      type: Boolean,
      default: true,
    },
    deactivatedAt: Date,
    lastLogin: Date,
    reactivationToken: {
      type: String,
      select: false,
    },
    reactivationExpires: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true },
);

const Customer: Model<ICustomer> = mongoose.model<ICustomer>(
  "Customer",
  customerSchema,
);

export default Customer;
