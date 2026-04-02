import db from "#db/index.js";
import { refunds } from "#db/schema.js";
import { and, desc, eq, sql } from "drizzle-orm";

export class RefundRepository {
  /**
   * Create a new refund record
   */
  async createRefund(data: {
    paymentId: string;
    invoiceId: string;
    refundId?: string;
    amount: string;
    reason?: string;
    notes?: string;
    status: string;
    gatewayResponse?: any;
    processedBy?: string;
    approvedBy?: string;
  }) {
    const [refund] = await db
      .insert(refunds)
      .values({
        paymentId: data.paymentId,
        invoiceId: data.invoiceId,
        refundId: data.refundId || null,
        amount: data.amount,
        reason: data.reason || null,
        notes: data.notes || null,
        status: data.status,
        gatewayResponse: data.gatewayResponse || null,
        processedBy: data.processedBy || null,
        approvedBy: data.approvedBy || null,
      })
      .returning();

    return refund;
  }

  /**
   * Get refund by ID
   */
  async getRefundById(refundId: string) {
    const [refund] = await db
      .select()
      .from(refunds)
      .where(eq(refunds.id, refundId))
      .limit(1);

    return refund || null;
  }

  /**
   * Get refund by gateway refund ID
   */
  async getRefundByGatewayId(gatewayRefundId: string) {
    const [refund] = await db
      .select()
      .from(refunds)
      .where(eq(refunds.refundId, gatewayRefundId))
      .limit(1);

    return refund || null;
  }

  /**
   * Get all refunds for a payment
   */
  async getRefundsByPayment(paymentId: string) {
    const refundsList = await db
      .select()
      .from(refunds)
      .where(eq(refunds.paymentId, paymentId))
      .orderBy(desc(refunds.createdAt));

    return refundsList;
  }

  /**
   * Get all refunds for an invoice
   */
  async getRefundsByInvoice(invoiceId: string) {
    const refundsList = await db
      .select()
      .from(refunds)
      .where(eq(refunds.invoiceId, invoiceId))
      .orderBy(desc(refunds.createdAt));

    return refundsList;
  }

  /**
   * Update refund status
   */
  async updateRefundStatus(
    refundId: string,
    status: string,
    additionalData?: {
      gatewayRefundId?: string;
      gatewayResponse?: any;
      completedAt?: Date;
    }
  ) {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (additionalData?.gatewayRefundId) {
      updateData.refundId = additionalData.gatewayRefundId;
    }

    if (additionalData?.gatewayResponse) {
      updateData.gatewayResponse = additionalData.gatewayResponse;
    }

    if (status === "completed" && additionalData?.completedAt) {
      updateData.completedAt = additionalData.completedAt;
    }

    const [updated] = await db
      .update(refunds)
      .set(updateData)
      .where(eq(refunds.id, refundId))
      .returning();

    return updated;
  }

  /**
   * Get all refunds with filters and pagination
   */
  async getAllRefunds(filters?: {
    paymentId?: string;
    invoiceId?: string;
    status?: string;
    processedBy?: string;
  }, pagination?: {
    page?: number;
    limit?: number;
  }) {
    const conditions = [];

    if (filters?.paymentId) {
      conditions.push(eq(refunds.paymentId, filters.paymentId));
    }

    if (filters?.invoiceId) {
      conditions.push(eq(refunds.invoiceId, filters.invoiceId));
    }

    if (filters?.status) {
      conditions.push(eq(refunds.status, filters.status));
    }

    if (filters?.processedBy) {
      conditions.push(eq(refunds.processedBy, filters.processedBy));
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const offset = (page - 1) * limit;

    const refundsList = await db
      .select()
      .from(refunds)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(refunds.createdAt))
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(refunds)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return {
      refunds: refundsList,
      total: Number(totalResult[0]?.count || 0),
      page,
      limit,
      totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / limit),
    };
  }

  /**
   * Get refund statistics
   */
  async getRefundStats(filters?: {
    startDate?: Date;
    endDate?: Date;
  }) {
    const conditions = [];

    if (filters?.startDate || filters?.endDate) {
      const dateConditions = [];
      if (filters?.startDate) {
        dateConditions.push(
          sql`${refunds.createdAt} >= ${filters.startDate.toISOString()}`
        );
      }
      if (filters?.endDate) {
        dateConditions.push(
          sql`${refunds.createdAt} <= ${filters.endDate.toISOString()}`
        );
      }
      conditions.push(and(...dateConditions));
    }

    // Total refunds
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(refunds)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Completed refunds
    const completedResult = await db
      .select({
        count: sql<number>`count(*)`,
        amount: sql<number>`SUM(CAST(${refunds.amount} AS FLOAT))`,
      })
      .from(refunds)
      .where(
        and(
          eq(refunds.status, "completed"),
          conditions.length > 0 ? and(...conditions) : undefined
        )
      );

    // Pending refunds
    const pendingResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(refunds)
      .where(
        and(
          eq(refunds.status, "initiated"),
          conditions.length > 0 ? and(...conditions) : undefined
        )
      );

    // Failed refunds
    const failedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(refunds)
      .where(
        and(
          eq(refunds.status, "failed"),
          conditions.length > 0 ? and(...conditions) : undefined
        )
      );

    return {
      total: Number(totalResult[0]?.count || 0),
      completed: Number(completedResult[0]?.count || 0),
      completedAmount: Number(completedResult[0]?.amount || 0),
      pending: Number(pendingResult[0]?.count || 0),
      failed: Number(failedResult[0]?.count || 0),
    };
  }

  /**
   * Get total refund amount
   */
  async getTotalRefundAmount(filters?: {
    startDate?: Date;
    endDate?: Date;
  }) {
    const conditions = [eq(refunds.status, "completed")];

    if (filters?.startDate || filters?.endDate) {
      if (filters?.startDate && filters?.endDate) {
        conditions.push(
          sql`${refunds.completedAt} >= ${filters.startDate.toISOString()} AND ${refunds.completedAt} <= ${filters.endDate.toISOString()}`
        );
      } else if (filters?.startDate) {
        conditions.push(sql`${refunds.completedAt} >= ${filters.startDate.toISOString()}`);
      } else if (filters?.endDate) {
        conditions.push(sql`${refunds.completedAt} <= ${filters.endDate.toISOString()}`);
      }
    }

    const result = await db
      .select({
        total: sql<number>`SUM(CAST(${refunds.amount} AS FLOAT))`,
      })
      .from(refunds)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return Number(result[0]?.total || 0);
  }

  /**
   * Get recent refunds
   */
  async getRecentRefunds(limit: number = 10) {
    const recentRefunds = await db
      .select()
      .from(refunds)
      .orderBy(desc(refunds.createdAt))
      .limit(limit);

    return recentRefunds;
  }

  /**
   * Check if payment has any pending refunds
   */
  async hasPendingRefunds(paymentId: string) {
    const [refund] = await db
      .select()
      .from(refunds)
      .where(
        and(
          eq(refunds.paymentId, paymentId),
          eq(refunds.status, "initiated")
        )
      )
      .limit(1);

    return !!refund;
  }

  /**
   * Get refund amount for a payment
   */
  async getTotalRefundedAmountForPayment(paymentId: string) {
    const result = await db
      .select({
        total: sql<number>`SUM(CAST(${refunds.amount} AS FLOAT))`,
      })
      .from(refunds)
      .where(
        and(
          eq(refunds.paymentId, paymentId),
          eq(refunds.status, "completed")
        )
      );

    return Number(result[0]?.total || 0);
  }
}

export const refundRepository = new RefundRepository();
