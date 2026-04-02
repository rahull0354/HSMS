import db from "#db/index.js";
import { provider_payouts, invoices, serviceProviders } from "#db/schema.js";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

export class PayoutRepository {
  /**
   * Create a new payout record
   */
  async createPayout(data: {
    providerId: string;
    payoutGroupId?: string;
    totalAmount: string;
    invoiceAmount: string;
    invoiceIds: string[];
    status: string;
    utr?: string;
    bankAccount?: {
      accountNumber?: string;
      ifsc?: string;
      accountHolder?: string;
      bankName?: string;
    };
    transactionId?: string;
    notes?: string;
    processedBy?: string;
  }) {
    const [payout] = await db
      .insert(provider_payouts)
      .values({
        providerId: data.providerId,
        payoutGroupId: data.payoutGroupId || null,
        totalAmount: data.totalAmount,
        invoiceAmount: data.invoiceAmount,
        invoiceIds: data.invoiceIds,
        status: data.status,
        utr: data.utr || null,
        bankAccount: data.bankAccount || {},
        transactionId: data.transactionId || null,
        notes: data.notes || null,
        processedBy: data.processedBy || null,
      })
      .returning();

    return payout;
  }

  /**
   * Get payout by ID
   */
  async getPayoutById(payoutId: string) {
    const [payout] = await db
      .select()
      .from(provider_payouts)
      .where(eq(provider_payouts.id, payoutId))
      .limit(1);

    return payout || null;
  }

  /**
   * Get all payouts for a provider
   */
  async getPayoutsByProvider(
    providerId: string,
    pagination?: { page?: number; limit?: number },
  ) {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const offset = (page - 1) * limit;

    const payouts = await db
      .select()
      .from(provider_payouts)
      .where(eq(provider_payouts.providerId, providerId))
      .orderBy(desc(provider_payouts.createdAt))
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(provider_payouts)
      .where(eq(provider_payouts.providerId, providerId));

    return {
      payouts,
      total: Number(totalResult[0]?.count || 0),
      page,
      limit,
      totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / limit),
    };
  }

  /**
   * Update payout status
   */
  async updatePayoutStatus(
    payoutId: string,
    status: string,
    additionalData?: {
      utr?: string;
      transactionId?: string;
      processedAt?: Date;
      completedAt?: Date;
      failureReason?: string;
      bankAccount?: any;
    },
  ) {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (additionalData?.utr) {
      updateData.utr = additionalData.utr;
    }

    if (additionalData?.transactionId) {
      updateData.transactionId = additionalData.transactionId;
    }

    if (additionalData?.bankAccount) {
      updateData.bankAccount = additionalData.bankAccount;
    }

    if (additionalData?.failureReason) {
      updateData.failureReason = additionalData.failureReason;
    }

    if (status === "processing" && additionalData?.processedAt) {
      updateData.processedAt = additionalData.processedAt;
    }

    if (status === "completed" && additionalData?.completedAt) {
      updateData.completedAt = additionalData.completedAt;
    }

    const [updated] = await db
      .update(provider_payouts)
      .set(updateData)
      .where(eq(provider_payouts.id, payoutId))
      .returning();

    return updated;
  }

  /**
   * Get pending payouts for all providers
   */
  async getPendingPayouts() {
    // Get all paid invoices that don't have a completed payout
    const paidInvoicesWithoutPayout = await db
      .select({
        providerId: invoices.serviceProviderId,
        invoiceId: invoices.id,
        providerEarning: invoices.providerEarning,
        paidAt: invoices.paidAt,
      })
      .from(invoices)
      .where(eq(invoices.status, "paid"));

    // Get all invoice IDs that have completed payouts
    const completedPayouts = await db
      .select({
        invoiceIds: provider_payouts.invoiceIds,
      })
      .from(provider_payouts)
      .where(eq(provider_payouts.status, "completed"));

    // Flatten all invoice IDs from completed payouts
    const completedInvoiceIds = new Set<string>();
    completedPayouts.forEach((payout) => {
      if (payout.invoiceIds && Array.isArray(payout.invoiceIds)) {
        payout.invoiceIds.forEach((id) => completedInvoiceIds.add(id));
      }
    });

    // Filter out invoices that already have completed payouts
    const pendingInvoices = paidInvoicesWithoutPayout.filter(
      (invoice) => !completedInvoiceIds.has(invoice.invoiceId),
    );

    // Group by provider
    const providerGroups = new Map<string, any[]>();
    pendingInvoices.forEach((invoice) => {
      if (!providerGroups.has(invoice.providerId)) {
        providerGroups.set(invoice.providerId, []);
      }
      providerGroups.get(invoice.providerId)?.push(invoice);
    });

    // Calculate totals for each provider
    const pendingPayouts = [];
    for (const [providerId, invoices] of providerGroups.entries()) {
      const totalAmount = invoices.reduce(
        (sum, inv) => sum + Number(inv.providerEarning),
        0,
      );

      pendingPayouts.push({
        providerId,
        invoiceCount: invoices.length,
        invoiceIds: invoices.map((inv) => inv.invoiceId),
        totalAmount: totalAmount.toString(),
        invoices,
      });
    }

    // Fetch provider details
    const result = [];
    for (const payout of pendingPayouts) {
      const [provider] = await db
        .select({
          id: serviceProviders.id,
          name: serviceProviders.name,
          email: serviceProviders.email,
          phone: serviceProviders.phone,
        })
        .from(serviceProviders)
        .where(eq(serviceProviders.id, payout.providerId))
        .limit(1);

      if (provider) {
        result.push({
          ...payout,
          provider,
        });
      }
    }

    return result;
  }

  /**
   * Get payout summary for a provider
   */
  async getProviderPayoutSummary(providerId: string) {
    // Get all payouts for provider
    const allPayouts = await db
      .select()
      .from(provider_payouts)
      .where(eq(provider_payouts.providerId, providerId));

    // Calculate totals
    const totalPaid = allPayouts
      .filter((p) => p.status === "completed")
      .reduce((sum, p) => sum + Number(p.totalAmount), 0);

    const totalPending = allPayouts
      .filter((p) => p.status === "pending")
      .reduce((sum, p) => sum + Number(p.totalAmount), 0);

    const totalProcessing = allPayouts
      .filter((p) => p.status === "processing")
      .reduce((sum, p) => sum + Number(p.totalAmount), 0);

    const recentPayouts = await db
      .select()
      .from(provider_payouts)
      .where(eq(provider_payouts.providerId, providerId))
      .orderBy(desc(provider_payouts.createdAt))
      .limit(5);

    return {
      totalPaid,
      totalPending,
      totalProcessing,
      totalPaidCount: allPayouts.filter((p) => p.status === "completed").length,
      totalPendingCount: allPayouts.filter((p) => p.status === "pending")
        .length,
      recentPayouts,
    };
  }

  /**
   * Get all payouts with filters and pagination
   */
  async getAllPayouts(
    filters?: {
      providerId?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    },
    pagination?: {
      page?: number;
      limit?: number;
    },
  ) {
    const conditions = [];

    if (filters?.providerId) {
      conditions.push(eq(provider_payouts.providerId, filters.providerId));
    }

    if (filters?.status) {
      conditions.push(eq(provider_payouts.status, filters.status));
    }

    if (filters?.startDate || filters?.endDate) {
      const dateConditions = [];
      if (filters?.startDate) {
        dateConditions.push(
          sql`${provider_payouts.createdAt} >= ${filters.startDate.toISOString()}`,
        );
      }
      if (filters?.endDate) {
        dateConditions.push(
          sql`${provider_payouts.createdAt} <= ${filters.endDate.toISOString()}`,
        );
      }
      conditions.push(and(...dateConditions));
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const offset = (page - 1) * limit;

    const payouts = await db
      .select()
      .from(provider_payouts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(provider_payouts.createdAt))
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(provider_payouts)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return {
      payouts,
      total: Number(totalResult[0]?.count || 0),
      page,
      limit,
      totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / limit),
    };
  }

  /**
   * Get payout statistics
   */
  async getPayoutStats(filters?: { startDate?: Date; endDate?: Date }) {
    const conditions = [];

    if (filters?.startDate || filters?.endDate) {
      const dateConditions = [];
      if (filters?.startDate) {
        dateConditions.push(
          sql`${provider_payouts.createdAt} >= ${filters.startDate.toISOString()}`,
        );
      }
      if (filters?.endDate) {
        dateConditions.push(
          sql`${provider_payouts.createdAt} <= ${filters.endDate.toISOString()}`,
        );
      }
      conditions.push(and(...dateConditions));
    }

    // Total payouts
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(provider_payouts)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Completed payouts
    const completedResult = await db
      .select({
        count: sql<number>`count(*)`,
        amount: sql<number>`SUM(CAST(${provider_payouts.totalAmount} AS FLOAT))`,
      })
      .from(provider_payouts)
      .where(
        and(
          eq(provider_payouts.status, "completed"),
          conditions.length > 0 ? and(...conditions) : undefined,
        ),
      );

    // Pending payouts
    const pendingResult = await db
      .select({
        count: sql<number>`count(*)`,
        amount: sql<number>`SUM(CAST(${provider_payouts.totalAmount} AS FLOAT))`,
      })
      .from(provider_payouts)
      .where(
        and(
          eq(provider_payouts.status, "pending"),
          conditions.length > 0 ? and(...conditions) : undefined,
        ),
      );

    // Processing payouts
    const processingResult = await db
      .select({
        count: sql<number>`count(*)`,
        amount: sql<number>`SUM(CAST(${provider_payouts.totalAmount} AS FLOAT))`,
      })
      .from(provider_payouts)
      .where(
        and(
          eq(provider_payouts.status, "processing"),
          conditions.length > 0 ? and(...conditions) : undefined,
        ),
      );

    return {
      total: Number(totalResult[0]?.count || 0),
      completed: Number(completedResult[0]?.count || 0),
      completedAmount: Number(completedResult[0]?.amount || 0),
      pending: Number(pendingResult[0]?.count || 0),
      pendingAmount: Number(pendingResult[0]?.amount || 0),
      processing: Number(processingResult[0]?.count || 0),
      processingAmount: Number(processingResult[0]?.amount || 0),
    };
  }

  /**
   * Get recent payouts
   */
  async getRecentPayouts(limit: number = 10) {
    const recentPayouts = await db
      .select()
      .from(provider_payouts)
      .orderBy(desc(provider_payouts.createdAt))
      .limit(limit);

    return recentPayouts;
  }

  /**
   * Delete a payout (only for failed/cancelled payouts)
   */
  async deletePayout(payoutId: string) {
    const [deleted] = await db
      .delete(provider_payouts)
      .where(eq(provider_payouts.id, payoutId))
      .returning();

    return deleted;
  }

  /**
   * Update payout failure reason
   */
  async markPayoutAsFailed(payoutId: string, failureReason: string) {
    const [updated] = await db
      .update(provider_payouts)
      .set({
        status: "failed",
        failureReason,
        updatedAt: new Date(),
      })
      .where(eq(provider_payouts.id, payoutId))
      .returning();

    return updated;
  }
}

export const payoutRepository = new PayoutRepository();
