import db from "#db/index.js";
import { invoices, payments } from "#db/schema.js";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

export class PaymentRepository {
  async createPayment(data: {
    invoiceId: string;
    gateway: string;
    gatewayPaymentId?: string;
    gatewayOrderId?: string;
    amount: string;
    currency?: string;
    paymentMethod?: string;
    status: string;
    gatewayResponse?: any;
    clientIp?: string;
    userAgent?: string;
    metadata?: any;
  }) {
    const [payment] = await db
      .insert(payments)
      .values({
        invoiceId: data.invoiceId,
        gateway: data.gateway,
        gatewayPaymentId: data.gatewayPaymentId || null,
        gatewayOrderId: data.gatewayOrderId || null,
        amount: data.amount,
        currency: data.currency || "INR",
        paymentMethod: data.paymentMethod || null,
        status: data.status,
        gatewayResponse: data.gatewayResponse || {},
        clientIp: data.clientIp || null,
        userAgent: data.userAgent || null,
        metadata: data.metadata || {},
        initiatedAt: new Date(),
      })
      .returning();

    return payment;
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string) {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    return payment || null;
  }

  /**
   * Get payment by gateway payment ID
   */
  async getPaymentByGatewayId(gatewayPaymentId: string) {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.gatewayPaymentId, gatewayPaymentId))
      .limit(1);

    return payment || null;
  }

  /**
   * Get payment by gateway order ID
   */
  async getPaymentByOrderId(gatewayOrderId: string) {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.gatewayOrderId, gatewayOrderId))
      .limit(1);

    return payment || null;
  }

  /**
   * Get all payments for an invoice
   */
  async getPaymentsByInvoice(invoiceId: string) {
    const paymentsList = await db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId))
      .orderBy(desc(payments.createdAt));

    return paymentsList;
  }

  /**
   * Get pending (initiated/processing) payment for an invoice
   * This is used to prevent duplicate payments
   */
  async getPendingPayment(invoiceId: string) {
    const [payment] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.invoiceId, invoiceId),
          inArray(payments.status, ["initiated", "processing"])
        )
      )
      .limit(1);

    return payment || null;
  }

  /**
   * Create payment with duplicate check
   * Returns existing pending payment if found, otherwise creates new one
   * This prevents race conditions and duplicate payments
   */
  async createPaymentWithDuplicateCheck(data: {
    invoiceId: string;
    gateway: string;
    gatewayOrderId?: string;
    amount: string;
    currency?: string;
    status: string;
    gatewayResponse?: any;
    clientIp?: string;
    userAgent?: string;
    metadata?: any;
  }) {
    // First, check for existing pending payment
    const existingPayment = await this.getPendingPayment(data.invoiceId);

    if (existingPayment) {
      console.log(`[PAYMENT] Found existing pending payment ${existingPayment.id} for invoice ${data.invoiceId}`);
      return existingPayment;
    }

    // No existing payment, create new one
    console.log(`[PAYMENT] Creating new payment for invoice ${data.invoiceId}`);

    const [payment] = await db
      .insert(payments)
      .values({
        invoiceId: data.invoiceId,
        gateway: data.gateway,
        gatewayPaymentId: null,
        gatewayOrderId: data.gatewayOrderId || null,
        amount: data.amount,
        currency: data.currency || "INR",
        paymentMethod: null,
        status: data.status,
        gatewayResponse: data.gatewayResponse || {},
        clientIp: data.clientIp || null,
        userAgent: data.userAgent || null,
        metadata: data.metadata || {},
        initiatedAt: new Date(),
      })
      .returning();

    return payment;
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    paymentId: string,
    status: string,
    additionalData?: {
      gatewayPaymentId?: string;
      gatewayResponse?: any;
      failureReason?: string;
      completedAt?: Date;
      failedAt?: Date;
      refundedAt?: Date;
    }
  ) {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (additionalData?.gatewayPaymentId) {
      updateData.gatewayPaymentId = additionalData.gatewayPaymentId;
    }

    if (additionalData?.gatewayResponse) {
      updateData.gatewayResponse = additionalData.gatewayResponse;
    }

    if (additionalData?.failureReason) {
      updateData.failureReason = additionalData.failureReason;
    }

    if (status === "completed" && additionalData?.completedAt) {
      updateData.completedAt = additionalData.completedAt;
    }

    if (status === "failed" && additionalData?.failedAt) {
      updateData.failedAt = additionalData.failedAt;
    }

    if (status === "refunded" && additionalData?.refundedAt) {
      updateData.refundedAt = additionalData.refundedAt;
    }

    const [updated] = await db
      .update(payments)
      .set(updateData)
      .where(eq(payments.id, paymentId))
      .returning();

    return updated;
  }

  /**
   * Get payments with filters and pagination
   */
  async getAllPayments(filters?: {
    invoiceId?: string;
    gateway?: string;
    status?: string;
    paymentMethod?: string;
    serviceProviderId?: string;
  }, pagination?: {
    page?: number;
    limit?: number;
  }) {
    const conditions = [];

    if (filters?.invoiceId) {
      conditions.push(eq(payments.invoiceId, filters.invoiceId));
    }

    if (filters?.gateway) {
      conditions.push(eq(payments.gateway, filters.gateway));
    }

    if (filters?.status) {
      conditions.push(eq(payments.status, filters.status));
    }

    if (filters?.paymentMethod) {
      conditions.push(eq(payments.paymentMethod, filters.paymentMethod));
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const offset = (page - 1) * limit;

    let query;
    let countQuery;

    // If filtering by serviceProviderId, we need to join with invoices
    if (filters?.serviceProviderId) {
      query = db
        .select({
          id: payments.id,
          invoiceId: payments.invoiceId,
          gateway: payments.gateway,
          gatewayPaymentId: payments.gatewayPaymentId,
          gatewayOrderId: payments.gatewayOrderId,
          amount: payments.amount,
          currency: payments.currency,
          paymentMethod: payments.paymentMethod,
          status: payments.status,
          failureReason: payments.failureReason,
          gatewayResponse: payments.gatewayResponse,
          clientIp: payments.clientIp,
          userAgent: payments.userAgent,
          metadata: payments.metadata,
          initiatedAt: payments.initiatedAt,
          completedAt: payments.completedAt,
          failedAt: payments.failedAt,
          refundedAt: payments.refundedAt,
          createdAt: payments.createdAt,
          updatedAt: payments.updatedAt,
        })
        .from(payments)
        .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
        .where(
          and(
            eq(invoices.serviceProviderId, filters.serviceProviderId),
            conditions.length > 0 ? and(...conditions) : undefined
          )
        )
        .orderBy(desc(payments.createdAt))
        .limit(limit)
        .offset(offset);

      // Count query with join
      const subquery = db
        .select({ count: sql<number>`count(*)` })
        .from(payments)
        .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
        .where(
          and(
            eq(invoices.serviceProviderId, filters.serviceProviderId),
            conditions.length > 0 ? and(...conditions) : undefined
          )
        );

      const [totalResult] = await subquery;
      const total = Number(totalResult?.count || 0);

      const paymentsList = await query;

      return {
        payments: paymentsList,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } else {
      // Normal query without join
      const paymentsList = await db
        .select()
        .from(payments)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(payments.createdAt))
        .limit(limit)
        .offset(offset);

      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(payments)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return {
        payments: paymentsList,
        total: Number(totalResult[0]?.count || 0),
        page,
        limit,
        totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / limit),
      };
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(filters?: {
    gateway?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const conditions = [];

    if (filters?.gateway) {
      conditions.push(eq(payments.gateway, filters.gateway));
    }

    if (filters?.startDate || filters?.endDate) {
      const dateConditions = [];
      if (filters?.startDate) {
        dateConditions.push(
          sql`${payments.createdAt} >= ${filters.startDate.toISOString()}`
        );
      }
      if (filters?.endDate) {
        dateConditions.push(
          sql`${payments.createdAt} <= ${filters.endDate.toISOString()}`
        );
      }
      conditions.push(and(...dateConditions));
    }

    // Total payments
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(payments)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Completed payments
    const completedResult = await db
      .select({
        count: sql<number>`count(*)`,
        amount: sql<number>`SUM(CAST(${payments.amount} AS FLOAT))`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.status, "completed"),
          conditions.length > 0 ? and(...conditions) : undefined
        )
      );

    // Failed payments
    const failedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(payments)
      .where(
        and(
          eq(payments.status, "failed"),
          conditions.length > 0 ? and(...conditions) : undefined
        )
      );

    // Pending payments
    const pendingResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(payments)
      .where(
        and(
          eq(payments.status, "initiated"),
          conditions.length > 0 ? and(...conditions) : undefined
        )
      );

    // Payment method distribution
    const methodDistribution = await db
      .select({
        method: payments.paymentMethod,
        count: sql<number>`count(*)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.status, "completed"),
          conditions.length > 0 ? and(...conditions) : undefined
        )
      )
      .groupBy(payments.paymentMethod);

    return {
      total: Number(totalResult[0]?.count || 0),
      completed: Number(completedResult[0]?.count || 0),
      completedAmount: Number(completedResult[0]?.amount || 0),
      failed: Number(failedResult[0]?.count || 0),
      pending: Number(pendingResult[0]?.count || 0),
      methodDistribution: methodDistribution.map((item) => ({
        method: item.method || "unknown",
        count: Number(item.count),
      })),
    };
  }

  /**
   * Get recent payments
   */
  async getRecentPayments(limit: number = 10) {
    const recentPayments = await db
      .select()
      .from(payments)
      .orderBy(desc(payments.createdAt))
      .limit(limit);

    return recentPayments;
  }

  /**
   * Check if invoice has any successful payment
   */
  async hasSuccessfulPayment(invoiceId: string) {
    const [payment] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.invoiceId, invoiceId),
          eq(payments.status, "completed")
        )
      )
      .limit(1);

    return !!payment;
  }

  /**
   * Get total revenue collected
   */
  async getTotalRevenue(filters?: {
    gateway?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const conditions = [eq(payments.status, "completed")];

    if (filters?.gateway) {
      conditions.push(eq(payments.gateway, filters.gateway));
    }

    if (filters?.startDate || filters?.endDate) {
      if (filters?.startDate && filters?.endDate) {
        conditions.push(
          sql`${payments.completedAt} >= ${filters.startDate.toISOString()} AND ${payments.completedAt} <= ${filters.endDate.toISOString()}`
        );
      } else if (filters?.startDate) {
        conditions.push(sql`${payments.completedAt} >= ${filters.startDate.toISOString()}`);
      } else if (filters?.endDate) {
        conditions.push(sql`${payments.completedAt} <= ${filters.endDate.toISOString()}`);
      }
    }

    const result = await db
      .select({
        total: sql<number>`SUM(CAST(${payments.amount} AS FLOAT))`,
      })
      .from(payments)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return Number(result[0]?.total || 0);
  }
}

export const paymentRepository = new PaymentRepository();
