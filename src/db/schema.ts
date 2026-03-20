import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    phone: varchar("phone", { length: 20 }),
    password: varchar("password", { length: 255 }).notNull(),
    address: jsonb("address").$type<{
      street?: string;
      city?: string;
      state?: string;
      pincode?: string;
      landmarks?: string;
    }>(),
    profilePicture: text("profile_picture"),
    isActive: boolean("is_active").default(true).notNull(),
    lastLogin: timestamp("last_login"),
    deactivatedAt: timestamp("deactivated_at"),
    reactivationToken: varchar("reactivation_token", { length: 255 }),
    reactivationExpires: timestamp("reactivation_expires"),
    createdAt: timestamp("created_at", {withTimezone: true}).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("customers_email_idx").on(table.email),
  }),
);

// Type for creating new customers
export type NewCustomer = typeof customers.$inferInsert;

export const admins = pgTable(
  "admins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    password: varchar("password", { length: 255 }).notNull(),
    lastLogin: timestamp("last_login"),
    createdAt: timestamp("created_at", {withTimezone: true}).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("admins_email_idx").on(table.email),
  }),
);

// Type for creating new admins
export type NewAdmin = typeof admins.$inferInsert;

export const serviceProviders = pgTable(
  "service_providers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    phone: varchar("phone", { length: 20 }),
    password: varchar("password", { length: 255 }).notNull(),
    profilePicture: text("profile_picture"),
    bio: text("bio"),
    skills: jsonb("skills")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    experienceYears: integer("experience_years")
      .default(0)
      .notNull(),
    certifications: jsonb("certifications")
      .$type<
        Array<{
          name?: string;
          issuedBy?: string;
          year?: number;
          certificateUrl?: string;
        }>
      >()
      .default(sql`'[]'::jsonb`),
    pricingType: varchar("pricing_type", { length: 50 })
      .default("per-visit")
      .notNull(),
    baseRate: decimal("base_rate", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    rateUnit: varchar("rate_unit", { length: 50 })
      .default("per-visit")
      .notNull(),
    servicePricing: jsonb("service_pricing")
      .$type<Array<{
        serviceCategoryId?: string;
        rate: number;
        minRate?: number;
        maxRate?: number;
      }>>()
      .default(sql`'[]'::jsonb`),
    availabilityStatus: varchar("availability_status", { length: 50 })
      .default("available")
      .notNull(),
    workingHours: jsonb("working_hours").$type<{
      from?: string;
      to?: string;
      daysOff?: string[];
    }>(),
    serviceArea: jsonb("service_area").$type<Array<{
      city: string;
      areas: string[];
    }>>(),
    averageRating: decimal("average_rating", { precision: 3, scale: 2 })
      .default("0")
      .notNull(),
    totalReviews: integer("total_reviews").default(0).notNull(),
    totalJobsCompleted: integer("total_jobs_completed").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    isSuspended: boolean("is_suspended").default(false).notNull(),
    suspensionReason: text("suspension_reason"),
    lastLogin: timestamp("last_login"),
    deactivatedAt: timestamp("deactivated_at"),
    reactivationToken: varchar("reactivation_token", { length: 255 }),
    reactivationExpires: timestamp("reactivation_expires"),
    createdAt: timestamp("created_at", {withTimezone: true}).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("service_providers_email_idx").on(table.email),
  }),
);

// Type for creating new customers
export type NewServiceProvider = typeof serviceProviders.$inferInsert;

export const serviceCategories = pgTable(
  "service_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: text("description"),
    icon: text("icon"),
    priceRange: jsonb("price_range").$type<{
      min?: number;
      max?: number;
      unit?: string;
    }>(),
    adminCommission: jsonb("admin_commission")
      .$type<{
        type: "fixed" | "percentage" | "hybrid";
        fixed?: number;
        percentage?: number;
        minCommission?: number;
        maxCommission?: number;
      }>()
      .notNull()
      .default(sql`'{"type": "fixed", "fixed": 0}'::jsonb`),
    commonServices: jsonb("common_services")
      .$type<
        Array<{
          name: string;
          typicalPrice: number;
          duration: string;
        }>
      >()
      .default(sql`'[]'::jsonb`),
    requiredSkills: jsonb("required_skills")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", {withTimezone: true}).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index("service_categories_name_idx").on(table.name),
    slugIdx: index("service_categories_slug_idx").on(table.slug),
  }),
);

// Type for creating new service categories
export type NewServiceCategory = typeof serviceCategories.$inferInsert;

export const serviceRequests = pgTable(
  "service_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    serviceProviderId: uuid("service_provider_id")
      .references(() => serviceProviders.id, { onDelete: "set null" }),
    serviceCategoryId: uuid("service_category_id")
      .notNull()
      .references(() => serviceCategories.id, { onDelete: "restrict" }),
    serviceType: varchar("service_type", { length: 255 }).notNull(),
    serviceTitle: varchar("service_title", { length: 500 }).notNull(),
    serviceDescription: text("service_description"),
    additionalNotes: text("additional_notes"),
    schedule: jsonb("schedule")
      .$type<{
        date: Date;
        timeSlot: "morning" | "afternoon" | "evening";
        preferredTime?: string;
      }>()
      .notNull(),
    serviceAddress: jsonb("service_address").$type<{
      street?: string;
      city?: string;
      state?: string;
      pincode?: string;
      landmarks?: string;
    }>(),
    beforeImages: jsonb("before_images")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`),
    afterImages: jsonb("after_images")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`),
    estimatedPrice: decimal("estimated_price", { precision: 10, scale: 2 }),
    finalPrice: decimal("final_price", { precision: 10, scale: 2 }),
    pricingDetails: jsonb("pricing_details").$type<{
      // Provider's earnings
      providerCharge: number;
      // Admin's profit
      adminCharge: number;
      // Additional costs
      additionalCharge?: number;
      additionalBreakdown?: string;
      // Totals
      subtotal?: number;
      total?: number;
      // Commission details
      commissionRate?: number;
      commissionType?: "fixed" | "percentage" | "hybrid";
    }>().notNull().default(sql`'{"providerCharge": 0, "adminCharge": 0}'::jsonb`),
    paymentStatus: varchar("payment_status", { length: 50 })
      .default("pending")
      .notNull(),
    paymentMethod: varchar("payment_method", { length: 100 }),
    status: varchar("status", { length: 50 }).default("requested").notNull(),
    statusHistory: jsonb("status_history")
      .$type<
        Array<{
          status: string;
          timestamp: Date;
          note?: string;
          updatedBy: "customer" | "service_provider" | "system";
        }>
      >()
      .default(sql`'[]'::jsonb`),
    cancellationReason: text("cancellation_reason"),
    cancelledBy: varchar("cancelled_by", { length: 50 }),
    cancelledAt: timestamp("cancelled_at"),
    isRecurring: boolean("is_recurring").default(false).notNull(),
    recurringPattern: jsonb("recurring_pattern").$type<{
      frequency?: "weekly" | "biweekly" | "monthly";
      endDate?: Date;
      nextServiceDate?: Date;
    }>(),
    parentRequestId: uuid("parent_request_id").references(
      (): any => serviceRequests.id,
      { onDelete: "set null" },
    ),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at", {withTimezone: true}).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => ({
    customerIdx: index("service_requests_customer_idx").on(table.customerId),
    serviceProviderIdx: index("service_requests_provider_idx").on(
      table.serviceProviderId,
    ),
    statusIdx: index("service_requests_status_idx").on(table.status),
  }),
);

// Type for creating new service requests
export type NewServiceRequest = typeof serviceRequests.$inferInsert;

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    serviceRequestId: uuid("service_request_id")
      .notNull()
      .unique()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    serviceProviderId: uuid("service_provider_id")
      .notNull()
      .references(() => serviceProviders.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    detailedRatings: jsonb("detailed_ratings").$type<{
      punctuality?: number;
      quality?: number;
      behaviour?: number;
      valueForMoney?: number;
    }>(),
    providerResponse: jsonb("provider_response").$type<{
      comment?: string;
      respondedAt?: Date;
    }>(),
    isVisible: boolean("is_visible").default(true).notNull(),
    isFlagged: boolean("is_flagged").default(false).notNull(),
    flagReason: text("flag_reason"),
    createdAt: timestamp("created_at", {withTimezone: true}).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => ({
    serviceRequestIdx: index("reviews_service_request_idx").on(
      table.serviceRequestId,
    ),
    customerIdx: index("reviews_customer_idx").on(table.customerId),
    serviceProviderIdx: index("reviews_provider_idx").on(
      table.serviceProviderId,
    ),
  }),
);

// Type for creating new reviews
export type NewReview = typeof reviews.$inferInsert;

export const notifications = pgTable('notifications', {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientId: uuid('recipient_id').notNull(),
    recipientType: varchar('recipient_type', {length: 50}).notNull(),
    type: varchar('type', {length: 100}).notNull(),
    title: varchar('title', {length: 500}).notNull(),
    message: text('message').notNull(),
    requestId: uuid('request_id').references(() => serviceRequests.id, {onDelete: 'cascade'}),
    isRead: boolean('is_read').default(false).notNull(),
    readAt: timestamp('read_at'),
    createdAt: timestamp("created_at", {withTimezone: true}).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", {withTimezone: true}).defaultNow().notNull(),
}, (table) => ({
    recipientIdx: index('notifications_recipient_idx').on(table.recipientId),
    recipientTypeIdx: index('notifications_recipient_type_idx').on(table.recipientType),
    isReadIdx: index('notifications_is_read_idx').on(table.isRead)
}))

// Type for creating new notifications
export type NewNotification = typeof notifications.$inferInsert;