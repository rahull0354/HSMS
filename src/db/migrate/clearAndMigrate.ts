import { db } from "../index.js";
import {
  admins,
  customers,
  notifications,
  reviews,
  serviceCategories,
  serviceProviders,
  serviceRequests,
} from "../schema.js";
import mongoose from "mongoose";
import { randomUUID } from "crypto";
import Admin from "#models/admin.model.js";
import ServiceCategories from "#models/serviceCategories.model.js";
import Customer from "#models/customer.model.js";
import ServiceProvider from "#models/serviceProvider.model.js";
import ServiceRequests from "#models/serviceRequests.model.js";
import Reviews from "#models/reviews.model.js";
import Notification from "#models/notification.model.js";

// id mapping to mongodb ObjectId -> postgresql uuid
const idMaps = {
  customers: new Map<string, string>(),
  admins: new Map<string, string>(),
  serviceProviders: new Map<string, string>(),
  serviceCategories: new Map<string, string>(),
  serviceRequests: new Map<string, string>(),
  reviews: new Map<string, string>(),
  notifications: new Map<string, string>(),
};

// helper to get or create UUID
function getUUID(collection: keyof typeof idMaps, mongoId: string): string {
  if (!idMaps[collection].has(mongoId)) {
    idMaps[collection].set(mongoId, randomUUID());
  }
  return idMaps[collection].get(mongoId)!;
}

// helper to convert decimal
function toDecimal(value: any): string | undefined {
  if (value === null || value === undefined) return undefined;
  return value.toString();
}

// helper to safely convert dates
function safeDate(value: any): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

// helper to safely get UUID for recipient
function getRecipientUUID(
  recipientType: string,
  recipientId: string,
): string | null {
  switch (recipientType) {
    case "customer":
      return idMaps.customers.has(recipientId)
        ? getUUID("customers", recipientId)
        : null;
    case "serviceProvider":
      return idMaps.serviceProviders.has(recipientId)
        ? getUUID("serviceProviders", recipientId)
        : null;
    default:
      return null;
  }
}

export async function clearPostgresTables() {
  console.log("🗑️  Clearing existing PostgreSQL data...\n");

  // Delete in reverse order of dependencies to avoid foreign key violations
  await db.delete(notifications);
  console.log("✅ Cleared notifications");

  await db.delete(reviews);
  console.log("✅ Cleared reviews");

  await db.delete(serviceRequests);
  console.log("✅ Cleared service requests");

  await db.delete(serviceProviders);
  console.log("✅ Cleared service providers");

  await db.delete(serviceCategories);
  console.log("✅ Cleared service categories");

  await db.delete(customers);
  console.log("✅ Cleared customers");

  await db.delete(admins);
  console.log("✅ Cleared admins");

  console.log("\n✨ All tables cleared successfully!\n");
}

export async function migrateAdmins() {
  console.log("🔄 Migrating Admins...");

  const mongoAdmins = await Admin.find({}).select("+password").lean();
  console.log(`Found ${mongoAdmins.length} admins in MongoDB`);

  let migratedCount = 0;
  let failedCount = 0;

  for (const admin of mongoAdmins) {
    try {
      const newId = getUUID("admins", admin._id.toString());

      await db
        .insert(admins)
        .values({
          id: newId,
          name: admin.name,
          email: admin.email,
          password: admin.password || "default_password_123",
          lastLogin: safeDate(admin.lastLogin),
          createdAt: safeDate(admin.createdAt) || new Date(),
          updatedAt: safeDate(admin.updatedAt) || new Date(),
        })
        .onConflictDoNothing();

      migratedCount++;
      console.log(`✅ Migrated Admin: ${admin.email}`);
    } catch (error: any) {
      failedCount++;
      console.log(
        `⚠️  Failed to migrate admin ${admin.email}: ${error.message}`,
      );
      idMaps.admins.delete(admin._id.toString());
    }
  }

  console.log(
    `✨ Admins migration completed! Migrated: ${migratedCount}, Failed: ${failedCount}\n`,
  );
}

export async function migrateServiceCategories() {
  console.log("🔄 Migrating Service Categories...");

  const mongoCategories = await ServiceCategories.find({}).lean();
  console.log(`Found ${mongoCategories.length} categories in MongoDB`);

  let migratedCount = 0;
  let failedCount = 0;

  for (const category of mongoCategories) {
    try {
      const newId = getUUID("serviceCategories", category._id.toString());

      await db
        .insert(serviceCategories)
        .values({
          id: newId,
          name: category.name,
          slug: category.slug,
          description: category.description,
          icon: category.icon,
          priceRange: category.priceRange,
          commonServices: category.commonServices || [],
          requiredSkills: category.requiredSkills || [],
          isActive: category.isActive ?? true,
          createdAt: safeDate(category.createdAt) || new Date(),
          updatedAt: safeDate(category.updatedAt) || new Date(),
        })
        .onConflictDoNothing();

      migratedCount++;
      console.log(`✅ Migrated category: ${category.name}`);
    } catch (error: any) {
      failedCount++;
      console.log(
        `⚠️  Failed to migrate category ${category.name}: ${error.message}`,
      );
      idMaps.serviceCategories.delete(category._id.toString());
    }
  }

  console.log(
    `✨ Service Categories migration completed! Migrated: ${migratedCount}, Failed: ${failedCount}\n`,
  );
}

export async function migrateCustomers() {
  console.log("🔄 Migrating Customers...");

  const mongoCustomers = await Customer.find({}).select("+password").lean();
  console.log(`Found ${mongoCustomers.length} customers in MongoDB`);

  let migratedCount = 0;
  let failedCount = 0;

  for (const customer of mongoCustomers) {
    try {
      const newId = getUUID("customers", customer._id.toString());

      await db
        .insert(customers)
        .values({
          id: newId,
          name: customer.name,
          email: customer.email,
          password: customer.password || "default_password_123",
          phone: customer.phone,
          address: customer.address,
          profilePicture: customer.profilePicture,
          isActive: customer.isActive ?? true,
          lastLogin: safeDate(customer.lastLogin),
          deactivatedAt: safeDate(customer.deactivatedAt),
          reactivationToken: customer.reactivationToken,
          reactivationExpires: safeDate(customer.reactivationExpires),
          createdAt: safeDate(customer.createdAt) || new Date(),
          updatedAt: safeDate(customer.updatedAt) || new Date(),
        })
        .onConflictDoNothing();

      migratedCount++;
      console.log(`✅ Migrated customer: ${customer.email}`);
    } catch (error: any) {
      failedCount++;
      console.log(
        `⚠️  Failed to migrate customer ${customer.email}: ${error.message}`,
      );
      idMaps.customers.delete(customer._id.toString());
    }
  }

  console.log(
    `✨ Customer migration completed! Migrated: ${migratedCount}, Failed: ${failedCount}\n`,
  );
}

export async function migrateServiceProviders() {
  console.log("🔄 Migrating Service Providers...");

  const mongoProviders = await ServiceProvider.find({})
    .select("+password")
    .lean();
  console.log(`Found ${mongoProviders.length} providers in MongoDB`);

  let migratedCount = 0;
  let failedCount = 0;

  for (const provider of mongoProviders) {
    try {
      const newId = getUUID("serviceProviders", provider._id.toString());

      await db
        .insert(serviceProviders)
        .values({
          id: newId,
          name: provider.name,
          email: provider.email,
          phone: provider.phone,
          password: provider.password || "default_password_123",
          profilePicture: provider.profilePicture,
          bio: provider.bio,
          skills: provider.skills || [],
          experienceYears: provider.experienceYears ?? 0,
          certifications: provider.certifications || [],
          pricingType: provider.pricingType || "per-visit",
          availabilityStatus: provider.availabilityStatus || "available",
          workingHours: provider.workingHours,
          serviceArea: provider.serviceArea,
          averageRating: toDecimal(provider.averageRating) || "0",
          totalReviews: provider.totalReviews ?? 0,
          totalJobsCompleted: provider.totalJobsCompleted ?? 0,
          isActive: provider.isActive ?? true,
          isSuspended: provider.isSuspended ?? false,
          suspensionReason: provider.suspensionReason,
          lastLogin: safeDate(provider.lastLogin),
          deactivatedAt: safeDate(provider.deactivatedAt),
          reactivationToken: provider.reactivationToken,
          reactivationExpires: safeDate(provider.reactivationExpires),
          createdAt: safeDate(provider.createdAt) || new Date(),
          updatedAt: safeDate(provider.updatedAt) || new Date(),
        } as any)
        .onConflictDoNothing();

      migratedCount++;
      console.log(`✅ Migrated service provider: ${provider.email}`);
    } catch (error: any) {
      failedCount++;
      console.log(
        `⚠️  Failed to migrate service provider ${provider.email}: ${error.message}`,
      );
      idMaps.serviceProviders.delete(provider._id.toString());
    }
  }

  console.log(
    `✨ Service Providers migration completed! Migrated: ${migratedCount}, Failed: ${failedCount}\n`,
  );
}

export async function migrateServiceRequests() {
  console.log("🔄 Migrating Service Requests...");

  const mongoRequests = await ServiceRequests.find({}).lean();
  console.log(`Found ${mongoRequests.length} service requests in MongoDB`);

  let migratedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const request of mongoRequests) {
    const customerId = request.customerId?.toString();
    const serviceCategoryId = request.serviceCategoryId?.toString();
    const serviceProviderId = request.serviceProviderId?.toString();

    // Check if customer and category exist in idMaps
    if (!customerId || !idMaps.customers.has(customerId)) {
      console.log(
        `⚠️  Skipping service request "${request.serviceTitle}" - customer not migrated`,
      );
      skippedCount++;
      continue;
    }

    if (
      !serviceCategoryId ||
      !idMaps.serviceCategories.has(serviceCategoryId)
    ) {
      console.log(
        `⚠️  Skipping service request "${request.serviceTitle}" - service category not migrated`,
      );
      skippedCount++;
      continue;
    }

    try {
      const newId = getUUID("serviceRequests", request._id.toString());

      // Process status history safely
      const statusHistory = ((request.statusHistory as any[]) || []).map(
        (h) => ({
          status: h.status,
          timestamp: safeDate(h.timeStamp || h.timestamp) || new Date(),
          note: h.note,
          updatedBy: h.updatedBy,
        }),
      );

      // Process schedule safely
      const schedule = request.schedule
        ? {
            date: safeDate(request.schedule.date) || new Date(),
            timeSlot: request.schedule.timeSlot as any,
            preferredTime: request.schedule.preferredTime,
          }
        : {
            date: new Date(),
            timeSlot: "morning" as const,
          };

      await db
        .insert(serviceRequests)
        .values({
          id: newId,
          customerId: getUUID("customers", customerId),
          serviceProviderId:
            serviceProviderId && idMaps.serviceProviders.has(serviceProviderId)
              ? getUUID("serviceProviders", serviceProviderId)
              : null,
          serviceCategoryId: getUUID("serviceCategories", serviceCategoryId),
          serviceType: request.serviceType,
          serviceTitle: request.serviceTitle,
          serviceDescription: request.serviceDescription,
          schedule,
          serviceAddress: request.serviceAddress,
          beforeImages: request.beforeImages || [],
          afterImages: request.afterImages || [],
          estimatedPrice: toDecimal(request.estimatedPrice),
          finalPrice: toDecimal(request.finalPrice),
          pricingDetails: request.pricingDetails,
          paymentMethod: request.paymentMethod,
          paymentStatus: request.paymentStatus || "pending",
          status: request.status || "requested",
          statusHistory,
          cancellationReason: request.cancellationReason,
          cancelledBy: request.cancelledBy,
          cancelledAt: safeDate(request.cancelledAt),
          isRecurring: request.isRecurring ?? false,
          recurringPattern: request.recurringPattern,
          parentRequestId:
            request.parentRequestId &&
            idMaps.serviceRequests.has(request.parentRequestId.toString())
              ? getUUID("serviceRequests", request.parentRequestId.toString())
              : null,
          completedAt: safeDate(request.completedAt),
          createdAt: safeDate(request.createdAt) || new Date(),
          updatedAt: safeDate(request.updatedAt) || new Date(),
        } as any)
        .onConflictDoNothing();

      migratedCount++;
      console.log(`✅ Migrated service request: ${request.serviceTitle}`);
    } catch (error: any) {
      failedCount++;
      console.log(
        `⚠️  Failed to migrate service request ${request.serviceTitle}: ${error.message}`,
      );
      idMaps.serviceRequests.delete(request._id.toString());
    }
  }

  console.log(
    `✨ Service Requests migration completed! Migrated: ${migratedCount}, Failed: ${failedCount}, Skipped: ${skippedCount}\n`,
  );
}

export async function migrateReviews() {
  console.log("🔄 Migrating Reviews...");

  const mongoReviews = await Reviews.find({}).lean();
  console.log(`Found ${mongoReviews.length} reviews in MongoDB`);

  let migratedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const review of mongoReviews) {
    const serviceRequestId = review.serviceRequestId?.toString();
    const customerId = review.customerId?.toString();
    const serviceProviderId = review.serviceProviderId?.toString();

    // Validate foreign keys exist
    if (!serviceRequestId || !idMaps.serviceRequests.has(serviceRequestId)) {
      console.log(`⚠️  Skipping review - service request not migrated`);
      skippedCount++;
      continue;
    }

    if (!customerId || !idMaps.customers.has(customerId)) {
      console.log(`⚠️  Skipping review - customer not migrated`);
      skippedCount++;
      continue;
    }

    if (!serviceProviderId || !idMaps.serviceProviders.has(serviceProviderId)) {
      console.log(`⚠️  Skipping review - service provider not migrated`);
      skippedCount++;
      continue;
    }

    try {
      const newId = getUUID("reviews", review._id.toString());

      await db
        .insert(reviews)
        .values({
          id: newId,
          serviceRequestId: getUUID("serviceRequests", serviceRequestId),
          customerId: getUUID("customers", customerId),
          serviceProviderId: getUUID("serviceProviders", serviceProviderId),
          rating: review.rating,
          comment: review.comment,
          detailedRatings: review.detailedRatings,
          providerResponse: review.providerResponse,
          isVisible: review.isVisible ?? true,
          isFlagged: review.isFlagged ?? false,
          flagReason: review.flagReason,
          createdAt: safeDate(review.createdAt) || new Date(),
          updatedAt: safeDate(review.updatedAt) || new Date(),
        })
        .onConflictDoNothing();

      migratedCount++;
      console.log(`✅ Migrated review: ${review.rating} stars`);
    } catch (error: any) {
      failedCount++;
      console.log(`⚠️  Failed to migrate review: ${error.message}`);
      idMaps.reviews.delete(review._id.toString());
    }
  }

  console.log(
    `✨ Reviews migration completed! Migrated: ${migratedCount}, Failed: ${failedCount}, Skipped: ${skippedCount}\n`,
  );
}

export async function migrateNotifications() {
  console.log("🔄 Migrating Notifications...");

  const mongoNotifications = await Notification.find({}).lean();
  console.log(`Found ${mongoNotifications.length} notifications in MongoDB`);

  let migratedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const notification of mongoNotifications) {
    const recipientId = notification.recipient?.toString();

    if (!recipientId) {
      console.log(`⚠️  Skipping notification - missing recipient ID`);
      skippedCount++;
      continue;
    }

    // Convert recipient ID to UUID
    const convertedRecipientId = getRecipientUUID(
      notification.recipientType,
      recipientId,
    );

    if (!convertedRecipientId) {
      console.log(
        `⚠️  Skipping notification "${notification.title}" - recipient not migrated`,
      );
      skippedCount++;
      continue;
    }

    try {
      const newId = getUUID("notifications", notification._id.toString());

      await db
        .insert(notifications)
        .values({
          id: newId,
          recipientId: convertedRecipientId,
          recipientType: notification.recipientType,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          requestId:
            notification.requestId &&
            idMaps.serviceRequests.has(notification.requestId.toString())
              ? getUUID("serviceRequests", notification.requestId.toString())
              : null,
          isRead: notification.isRead ?? false,
          readAt: safeDate(notification.readAt),
          createdAt: safeDate(notification.createdAt) || new Date(),
          updatedAt: safeDate(notification.updatedAt) || new Date(),
        })
        .onConflictDoNothing();

      migratedCount++;
      console.log(`✅ Migrated notification: ${notification.title}`);
    } catch (error: any) {
      failedCount++;
      console.log(
        `⚠️  Failed to migrate notification ${notification.title}: ${error.message}`,
      );
      idMaps.notifications.delete(notification._id.toString());
    }
  }

  console.log(
    `✨ Notifications migration completed! Migrated: ${migratedCount}, Failed: ${failedCount}, Skipped: ${skippedCount}\n`,
  );
}

export async function clearAndMigrateAll() {
  console.log("🚀 Starting PostgreSQL cleanup and MongoDB migration...\n");

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI not found in environment variables");
  }

  await mongoose.connect(mongoUri);
  console.log("✅ Connected to MongoDB");

  try {
    // Clear existing data
    await clearPostgresTables();

    // Migrate in order of dependencies
    await migrateAdmins();
    await migrateCustomers();
    await migrateServiceProviders();
    await migrateServiceCategories();
    await migrateServiceRequests();
    await migrateReviews();
    await migrateNotifications();

    console.log("🎉 All migrations completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`  - Admins: ${idMaps.admins.size}`);
    console.log(`  - Customers: ${idMaps.customers.size}`);
    console.log(`  - Service Providers: ${idMaps.serviceProviders.size}`);
    console.log(`  - Service Categories: ${idMaps.serviceCategories.size}`);
    console.log(`  - Service Requests: ${idMaps.serviceRequests.size}`);
    console.log(`  - Reviews: ${idMaps.reviews.size}`);
    console.log(`  - Notifications: ${idMaps.notifications.size}`);
  } catch (error) {
    console.error("💥 Migration failed:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

clearAndMigrateAll()
  .then(() => {
    console.log("\n✨ Migration script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Migration script failed:", error);
    process.exit(1);
  });
