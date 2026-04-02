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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
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
    experienceYears: integer("experience_years").default(0).notNull(),
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
      .$type<
        Array<{
          serviceCategoryId?: string;
          rate: number;
          minRate?: number;
          maxRate?: number;
        }>
      >()
      .default(sql`'[]'::jsonb`),
    availabilityStatus: varchar("availability_status", { length: 50 })
      .default("available")
      .notNull(),
    workingHours: jsonb("working_hours").$type<{
      from?: string;
      to?: string;
      daysOff?: string[];
    }>(),
    serviceArea: jsonb("service_area").$type<
      Array<{
        city: string;
        areas: string[];
      }>
    >(),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
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
    serviceProviderId: uuid("service_provider_id").references(
      () => serviceProviders.id,
      { onDelete: "set null" },
    ),
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
    materialCost: decimal("material_cost", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    materialDescription: text("material_description"),
    pricingDetails: jsonb("pricing_details")
      .$type<{
        // Provider's earnings
        providerCharge: number;
        // Admin's profit
        adminCharge: number;
        // Additional costs
        additionalCharge?: number;
        additionalBreakdown?: string;
        // Totals
        subTotal?: number;
        total?: number;
        // Commission details
        commissionRate?: number;
        commissionType?: "fixed" | "percentage" | "hybrid";
      }>()
      .notNull()
      .default(sql`'{"providerCharge": 0, "adminCharge": 0}'::jsonb`),
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
    invoiceId: varchar("invoice_id", { length: 100 }).unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
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

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientId: uuid("recipient_id").notNull(),
    recipientType: varchar("recipient_type", { length: 50 }).notNull(),
    type: varchar("type", { length: 100 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    message: text("message").notNull(),
    requestId: uuid("request_id").references(() => serviceRequests.id, {
      onDelete: "cascade",
    }),
    reviewId: uuid("review_id").references(() => reviews.id, {
      onDelete: "cascade",
    }),
    payoutId: uuid("payout_id").references(() => provider_payouts.id, {
      onDelete: "cascade",
    }),
    metadata: jsonb("metadata"),
    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    recipientIdx: index("notifications_recipient_idx").on(table.recipientId),
    recipientTypeIdx: index("notifications_recipient_type_idx").on(
      table.recipientType,
    ),
    isReadIdx: index("notifications_is_read_idx").on(table.isRead),
  }),
);

// Type for creating new notifications
export type NewNotification = typeof notifications.$inferInsert;

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceNumber: varchar("invoice_number", { length: 100 })
      .notNull()
      .unique(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    serviceProviderId: uuid("service_provider_id")
      .notNull()
      .references(() => serviceProviders.id, { onDelete: "restrict" }),
    subTotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    materialCost: decimal("material_cost", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    laborCost: decimal("labor_cost", { precision: 10, scale: 2 }).notNull(),
    taxAmount: decimal("tax_amount", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    taxRate: decimal("tax_rate", { precision: 5, scale: 2 })
      .default("0")
      .notNull(),
    discountAmount: decimal("discount_amount", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    platformFeeRate: decimal("platform_fee_rate", { precision: 5, scale: 2 })
      .default("0.15")
      .notNull(),
    platformFee: decimal("platform_fee", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    providerEarning: decimal("provider_earning", {
      precision: 10,
      scale: 2,
    }).notNull(),
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    invoiceDate: timestamp("invoice_date", { withTimezone: true })
      .defaultNow()
      .notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentMethod: varchar("payment_method", { length: 50 }),
    paymentId: varchar("payment_id", { length: 255 }),
    transactionId: varchar("transaction_id", { length: 255 }),
    notes: text("notes"),
    terms: text("terms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    invoiceNumberIdx: index("invoices_invoice_number_idx").on(
      table.invoiceNumber,
    ),
    requestIdIdx: index("invoices_request_id_idx").on(table.requestId),
    customerIdIdx: index("invoices_customer_id_idx").on(table.customerId),
    serviceProviderIdIdx: index("invoices_service_provider_id_idx").on(
      table.customerId,
    ),
    statusIdx: index("invoices_status_idx").on(table.status),
  }),
);

export type NewInvoice = typeof invoices.$inferInsert;

export const invoiceLineItems = pgTable(
  "invoice_line_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: varchar("description", { length: 255 }).notNull(),
    quantity: integer("quantity").default(1).notNull(),
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
    total: decimal("total", { precision: 10, scale: 2 }).notNull(),
    itemType: varchar("item_type", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    invoiceIdIdx: index("invoice_line_items_invoice_id_idx").on(
      table.invoiceId,
    ),
  }),
);

export type NewInvoiceLineItem = typeof invoiceLineItems.$inferInsert;

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),

    // payment gateway details
    gateway: varchar("gateway", { length: 50 }).notNull(),
    gatewayPaymentId: varchar("gateway_payment_id", { length: 255 }).unique(),
    gatewayOrderId: varchar("gateway_order_id", { length: 255 }),

    // payment details
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).default("INR").notNull(),
    paymentMethod: varchar("payment_method", { length: 50 }),

    //status tracking
    status: varchar("status", { length: 50 }).notNull(),
    failureReason: text("failure_reason"),

    //gateway response
    gatewayResponse: jsonb("gateway_response").$type<{
      status?: string;
      method?: string;
      acquirer?: string;
      bank?: string;
      wallet?: string;
      vpa?: string;
      cardId?: string;
    }>(),

    // Metadata
    clientIp: varchar("client_ip", { length: 50 }),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").$type<{
      source?: string;
      device?: string;
      [key: string]: any;
    }>(),

    //timestamps
    initiatedAt: timestamp("initiated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    invoiceIdIdx: index("payments_invoice_id_idx").on(table.invoiceId),
    gatewayPaymentIdIdx: index("payments_gateway_payment_id_idx").on(
      table.gatewayPaymentId,
    ),
    statusIdx: index("payments_status_idx").on(table.status),
    createdAtIdx: index("payments_created_at_idx").on(table.createdAt),
    // Partial unique index: Only ONE initiated/processing payment per invoice
    invoicePendingUniqueIdx: index("payments_invoice_pending_unique_idx")
      .on(table.invoiceId)
      .where(sql`status IN ('initiated', 'processing')`)
      .concurrently(),
  }),
);

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),

    //refund details
    refundId: varchar("refund_id", { length: 255 }).unique(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    reason: varchar("reason", { length: 255 }),
    notes: text("notes"),

    // status
    status: varchar("status", { length: 50 }).notNull(),

    //gateway response
    gatewayResponse: jsonb("gateway_response"),

    //processing details
    processedBy: uuid("processed_by").references(() => admins.id),
    approvedBy: uuid("approved_by").references(() => admins.id),

    //timestamps
    initiatedAt: timestamp("initiated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    paymentIdIdx: index("refunds_payment_id_idx").on(table.paymentId),
    invoiceIdIdx: index("refunds_invoice_id_idx").on(table.invoiceId),
    statusIdx: index("refunds_status_idx").on(table.status),
  }),
);

export const provider_payouts = pgTable(
  "provider_payouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => serviceProviders.id, { onDelete: "restrict" }),

    //payout details
    payoutGroupId: varchar("payout_group_id", { length: 255 }),
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
    invoiceAmount: decimal("invoice_amount", {precision: 10, scale: 2}).notNull(),

    //breakdown
    invoiceIds: jsonb("invoice_ids").$type<string[]>(),

    //status
    status: varchar("status", { length: 50 }).notNull(),

    //transaction details
    utr: varchar("utr", { length: 255 }), // UPI Transaction reference
    bankAccount: jsonb("bank_account").$type<{
      accountNumber?: string;
      ifsc?: string;
      accountHolder?: string;
      bankName?: string;
    }>(),
    transactionId: varchar("transaction_id", { length: 255 }),
    notes: text("notes"),

    //processing details
    processedBy: uuid("processed_by").references(() => admins.id),
    failureReason: text("failure_reason"),

    //timestamps
    initiatedAt: timestamp("initiated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    providerIdIdx: index("provider_payouts_provider_id_idx").on(
      table.providerId,
    ),
    statusIdx: index("provider_payouts_status_idx").on(table.status),
    createdAtIdx: index("provider_payouts_created_at_idx").on(table.createdAt),
  }),
);

export const provider_bank_accounts = pgTable(
  "provider_bank_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => serviceProviders.id, { onDelete: "cascade" }),

    // Bank account details
    accountNumber: varchar("account_number", { length: 255 }).notNull(), // Should be encrypted in application layer
    accountNumberLast4: varchar("account_number_last4", { length: 4 }).notNull(), // Last 4 digits for display
    ifsc: varchar("ifsc", { length: 11 }).notNull(),
    accountHolder: varchar("account_holder", { length: 255 }).notNull(),
    bankName: varchar("bank_name", { length: 255 }).notNull(),
    accountType: varchar("account_type", { length: 20 })
      .default("savings")
      .notNull(), // savings, current, etc.

    // Verification status
    isPrimary: boolean("is_primary").default(false).notNull(),
    isVerified: boolean("is_verified").default(false).notNull(),
    verificationStatus: varchar("verification_status", { length: 20 })
      .default("pending")
      .notNull(), // pending, verified, failed
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verificationReference: varchar("verification_reference", { length: 255 }),

    // Additional details
    upiId: varchar("upi_id", { length: 255 }), // For UPI-based payouts
    branch: varchar("branch", { length: 255 }),
    notes: text("notes"),

    // Metadata
    isActive: boolean("is_active").default(true).notNull(),
    deactivationReason: text("deactivation_reason"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => ({
    providerIdIdx: index("provider_bank_accounts_provider_id_idx").on(
      table.providerId,
    ),
    primaryIdx: index("provider_bank_accounts_primary_idx").on(
      table.providerId,
      table.isPrimary,
    ),
    verificationStatusIdx: index(
      "provider_bank_accounts_verification_status_idx",
    ).on(table.verificationStatus),
    createdAtIdx: index("provider_bank_accounts_created_at_idx").on(
      table.createdAt,
    ),
  }),
);

export type NewProviderBankAccount = typeof provider_bank_accounts.$inferInsert;
