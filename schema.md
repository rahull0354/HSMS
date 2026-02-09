# Home Service Management - MongoDB Schema

---

## 1. Customers Collection

```javascript
{
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  password: { type: String, required: true, select: false },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    landmarks: String
  },
  profilePicture: String,
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  lastLogin: Date
},
{ timestamps: true }
```

---

## 2. ServiceProviders Collection

```javascript
{
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  password: { type: String, required: true, select: false },
  profilePicture: String,
  bio: String,

  skills: { type: [String], required: true },
  experienceYears: { type: Number, default: 0 },
  certifications: [{
    name: String,
    issuedBy: String,
    year: Number,
    certificateUrl: String
  }],

  pricing: {
    pricingType: {
      type: String,
      enum: ['hourly', 'per-visit', 'per-job', 'fixed', 'quote'],
      default: 'per-visit'
    },
    baseCharge: { type: Number, required: true, min: 0 },
    rate: { type: Number, min: 0 },
    currency: { type: String, default: 'USD' }
  },

  availabilityStatus: {
    type: String,
    enum: ['available', 'busy', 'offline'],
    default: 'available'
  },
  workingHours: {
    from: String,
    to: String,
    daysOff: [String]
  },
  serviceArea: {
    cities: [String],
    areas: [String]
  },

  averageRating: { type: Number, default: 0, min: 0, max: 5 },
  totalReviews: { type: Number, default: 0 },
  totalJobsCompleted: { type: Number, default: 0 },

  isActive: { type: Boolean, default: true },
  isSuspended: { type: Boolean, default: false },
  suspensionReason: String,
  lastLogin: Date
},
{ timestamps: true }
```

---

## 3. ServiceCategories Collection

```javascript
{
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  description: String,
  icon: String,
  priceRange: {
    min: Number,
    max: Number,
    unit: String
  },
  commonServices: [{
    name: String,
    typicalPrice: Number,
    duration: String
  }],
  requiredSkills: [String],
  isActive: { type: Boolean, default: true }
},
{ timestamps: true }
```

---

## 4. ServiceRequests Collection

```javascript
{
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  serviceProvider: { type: Schema.Types.ObjectId, ref: 'ServiceProvider' },

  serviceType: { type: String, required: true },
  category: { type: Schema.Types.ObjectId, ref: 'ServiceCategory' },
  title: { type: String, required: true },
  description: String,

  schedule: {
    date: { type: Date, required: true },
    timeSlot: { type: String, enum: ['morning', 'afternoon', 'evening'], required: true },
    preferredTime: String
  },

  serviceAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    landmarks: String
  },

  beforeImages: [String],
  afterImages: [String],

  estimatedPrice: Number,
  finalPrice: Number,
  pricingDetails: {
    baseCharge: Number,
    additionalCharge: Number,
    breakdown: String
  },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'refunded'], default: 'pending' },
  paymentMethod: String,

  status: {
    type: String,
    enum: ['requested', 'assigned', 'in_progress', 'completed', 'cancelled'],
    default: 'requested'
  },
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    note: String,
    updatedBy: { type: String, enum: ['customer', 'provider', 'system'] }
  }],

  cancellationReason: String,
  cancelledBy: { type: String, enum: ['customer', 'provider', 'system'] },
  cancelledAt: Date,

  isRecurring: { type: Boolean, default: false },
  recurringPattern: {
    frequency: { type: String, enum: ['weekly', 'biweekly', 'monthly'] },
    endDate: Date,
    nextServiceDate: Date
  },
  parentRequestId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest' },

  completedAt: Date
},
{ timestamps: true }
```

---

## 5. Reviews Collection

```javascript
{
  serviceRequest: { type: Schema.Types.ObjectId, ref: 'ServiceRequest', required: true, unique: true },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  serviceProvider: { type: Schema.Types.ObjectId, ref: 'ServiceProvider', required: true },

  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: String,

  detailedRatings: {
    punctuality: { type: Number, min: 1, max: 5 },
    quality: { type: Number, min: 1, max: 5 },
    behavior: { type: Number, min: 1, max: 5 },
    valueForMoney: { type: Number, min: 1, max: 5 }
  },

  providerResponse: {
    comment: String,
    respondedAt: Date
  },

  isVisible: { type: Boolean, default: true },
  isFlagged: { type: Boolean, default: false }
},
{ timestamps: true }
```

---

## 6. Notifications Collection

```javascript
{
  recipient: { type: Schema.Types.ObjectId, required: true },
  recipientType: { type: String, enum: ['customer', 'provider'], required: true },

  type: {
    type: String,
    enum: ['request_created', 'request_assigned', 'request_started', 'request_completed', 'request_cancelled', 'new_review', 'payment_reminder'],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },

  requestId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest' },
  reviewId: { type: Schema.Types.ObjectId, ref: 'Review' },

  isRead: { type: Boolean, default: false },
  readAt: Date
},
{ timestamps: true }
```

---

## Mongoose Models

### Customer.js

```javascript
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const customerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, trim: true },
    password: { type: String, required: true, select: false },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      landmarks: String,
    },
    profilePicture: String,
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    lastLogin: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Customer", customerSchema);
```

### ServiceProvider.js

```javascript
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const serviceProviderSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, trim: true },
    password: { type: String, required: true, select: false },
    profilePicture: String,
    bio: String,
    skills: { type: [String], required: true },
    experienceYears: { type: Number, default: 0 },
    certifications: [
      {
        name: String,
        issuedBy: String,
        year: Number,
        certificateUrl: String,
      },
    ],
    pricing: {
      pricingType: {
        type: String,
        enum: ["hourly", "per-visit", "per-job", "fixed", "quote"],
        default: "per-visit",
      },
      baseCharge: { type: Number, required: true, min: 0 },
      rate: { type: Number, min: 0 },
      currency: { type: String, default: "USD" },
    },
    availabilityStatus: {
      type: String,
      enum: ["available", "busy", "offline"],
      default: "available",
    },
    workingHours: {
      from: String,
      to: String,
      daysOff: [String],
    },
    serviceArea: {
      cities: [String],
      areas: [String],
    },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    totalJobsCompleted: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    verificationDocuments: [String],
    isActive: { type: Boolean, default: true },
    isSuspended: { type: Boolean, default: false },
    suspensionReason: String,
    lastLogin: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model("ServiceProvider", serviceProviderSchema);
```

### ServiceCategory.js

```javascript
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const serviceCategorySchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    description: String,
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
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ServiceCategory", serviceCategorySchema);
```

### ServiceRequest.js

```javascript
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const serviceRequestSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    serviceProvider: { type: Schema.Types.ObjectId, ref: "ServiceProvider" },
    serviceType: { type: String, required: true },
    category: { type: Schema.Types.ObjectId, ref: "ServiceCategory" },
    title: { type: String, required: true },
    description: String,
    schedule: {
      date: { type: Date, required: true },
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
      baseCharge: Number,
      additionalCharge: Number,
      breakdown: String,
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
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String,
        updatedBy: { type: String, enum: ["customer", "provider", "system"] },
      },
    ],
    cancellationReason: String,
    cancelledBy: { type: String, enum: ["customer", "provider", "system"] },
    cancelledAt: Date,
    isRecurring: { type: Boolean, default: false },
    recurringPattern: {
      frequency: { type: String, enum: ["weekly", "biweekly", "monthly"] },
      endDate: Date,
      nextServiceDate: Date,
    },
    parentRequestId: { type: Schema.Types.ObjectId, ref: "ServiceRequest" },
    completedAt: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model("ServiceRequest", serviceRequestSchema);
```

### Review.js

```javascript
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const reviewSchema = new Schema(
  {
    serviceRequest: {
      type: Schema.Types.ObjectId,
      ref: "ServiceRequest",
      required: true,
      unique: true,
    },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    serviceProvider: {
      type: Schema.Types.ObjectId,
      ref: "ServiceProvider",
      required: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: String,
    detailedRatings: {
      punctuality: { type: Number, min: 1, max: 5 },
      quality: { type: Number, min: 1, max: 5 },
      behavior: { type: Number, min: 1, max: 5 },
      valueForMoney: { type: Number, min: 1, max: 5 },
    },
    providerResponse: {
      comment: String,
      respondedAt: Date,
    },
    isVisible: { type: Boolean, default: true },
    isFlagged: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Review", reviewSchema);
```

### Notification.js

```javascript
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, required: true },
    recipientType: {
      type: String,
      enum: ["customer", "provider"],
      required: true,
    },
    type: {
      type: String,
      enum: [
        "request_created",
        "request_assigned",
        "request_started",
        "request_completed",
        "request_cancelled",
        "new_review",
        "payment_reminder",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    requestId: { type: Schema.Types.ObjectId, ref: "ServiceRequest" },
    reviewId: { type: Schema.Types.ObjectId, ref: "Review" },
    isRead: { type: Boolean, default: false },
    readAt: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Notification", notificationSchema);
```

---

## Pricing Types Reference

| Type        | Description                   | Example Use Case            |
| ----------- | ----------------------------- | --------------------------- |
| `hourly`    | Charged per hour + base fee   | Electrician, Carpenter      |
| `per-visit` | Flat rate per visit           | Plumber, General repairs    |
| `per-job`   | Fixed price per specific task | AC repair, Appliance repair |
| `fixed`     | Same price always             | House cleaning, Lawn mowing |
| `quote`     | Price after inspection        | Complex repairs, Renovation |

---

## Status Values Reference

### ServiceRequest Status

- `requested` - New request created
- `assigned` - Provider assigned
- `in_progress` - Work in progress
- `completed` - Work completed
- `cancelled` - Request cancelled

### Payment Status

- `pending` - Payment pending
- `paid` - Payment completed
- `refunded` - Payment refunded

### Provider Availability

- `available` - Available for new jobs
- `busy` - Currently working
- `offline` - Not available
