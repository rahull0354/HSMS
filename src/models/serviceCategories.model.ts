import mongoose, { Document, Model } from "mongoose";

interface IServiceCategories extends Document {
  name: string;
  slug: string;
  description: string;
  icon: string;
  priceRange: {
    min: number;
    max: number;
    unit: string;
  };
  commonServices: Array<{
    name: string;
    typicalPrice: number;
    duration: string;
  }>;
  requiredSkills: string[];
  isActive: boolean;
}

const serviceCategoriesSchema = new mongoose.Schema<IServiceCategories>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
    },
    icon: String,
    priceRange: {
      min: Number,
      max: Number,
      unit: String,
    },
    commonServices: [
      {
        name: String,
        typicalPrice: Number,
        duration: String,
      },
    ],
    requiredSkills: [String],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const ServiceCategories: Model<IServiceCategories> =
  mongoose.model<IServiceCategories>(
    "ServiceCategories",
    serviceCategoriesSchema,
  );

export default ServiceCategories;
