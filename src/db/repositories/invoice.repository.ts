import db from "#db/index.js";
import { invoiceLineItems, invoices, serviceRequests } from "#db/schema.js";
import { and, eq, sql } from "drizzle-orm";

export class InvoiceRepository {
  // Generate invoice number: INV-YYYY-MM-NNNN
  async generateInvoiceNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    try {
      // Get all invoices and count ones created in current month
      const allInvoices = await db.select().from(invoices);

      // Filter invoices created in current month
      const monthlyInvoices = allInvoices.filter((invoice) => {
        if (!invoice.createdAt) return false;
        const invoiceDate = new Date(invoice.createdAt);
        return (
          invoiceDate.getFullYear() === year &&
          invoiceDate.getMonth() === now.getMonth()
        );
      });

      const sequence = String(monthlyInvoices.length + 1).padStart(4, "0");
      return `INV-${year}-${month}-${sequence}`;
    } catch (error) {
      console.error("Error generating invoice number:", error);
      // Fallback to timestamp-based sequence if counting fails
      const timestamp = Date.now().toString().slice(-4);
      return `INV-${year}-${month}-${timestamp}`;
    }
  }

  // Create invoice with line items
  async createInvoice(data: {
    requestId: string;
    customerId: string;
    serviceProviderId: string;
    subTotal: number;
    materialCost: number;
    laborCost: number;
    taxAmount: number;
    taxRate: number;
    discountAmount: number;
    platformFeeRate: number;
    platformFee: number;
    providerEarning: number;
    totalAmount: number;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
      itemType?: string;
    }>;
  }) {
    const invoiceNumber = await this.generateInvoiceNumber();

    const [invoice] = await db
      .insert(invoices)
      .values({
        invoiceNumber,
        requestId: data.requestId,
        customerId: data.customerId,
        serviceProviderId: data.serviceProviderId,
        subTotal: data.subTotal.toString(),
        materialCost: data.materialCost.toString(),
        laborCost: data.laborCost.toString(),
        taxAmount: data.taxAmount.toString(),
        taxRate: data.taxRate.toString(),
        discountAmount: data.discountAmount.toString(),
        platformFeeRate: data.platformFeeRate.toString(),
        platformFee: data.platformFee.toString(),
        providerEarning: data.providerEarning.toString(),
        totalAmount: data.totalAmount.toString(),
        status: "pending",
      })
      .returning();

    if (data.lineItems.length > 0) {
      await db.insert(invoiceLineItems).values(
        data.lineItems.map((item) => ({
          invoiceId: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
          total: item.total.toString(),
          itemType: item.itemType || "service",
        })),
      );
    }

    return invoice;
  }

  // Get invoice by ID
  async getInvoiceById(id: string) {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1);

    return invoice;
  }

  // Get invoice by invoice number
  async getInvoiceByNumber(invoiceNumber: string) {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, invoiceNumber))
      .limit(1);

    return invoice;
  }

  // Get invoices by customer
  async getInvoicesByCustomer(customerId: string) {
    return await db
      .select()
      .from(invoices)
      .where(eq(invoices.customerId, customerId))
      .orderBy(invoices.createdAt);
  }

  // Get invoices by provider
  async getInvoicesByProvider(providerId: string) {
    return await db
      .select()
      .from(invoices)
      .where(eq(invoices.serviceProviderId, providerId))
      .orderBy(invoices.createdAt);
  }

  // Get invoice with line items
  async getInvoiceWithLineItems(invoiceId: string) {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice) return null;

    const lineItems = await db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId));

    return {
      ...invoice,
      lineItems,
    };
  }

  // Update invoice status
  async updateInvoiceStatus(
    invoiceId: string,
    status: "pending" | "paid" | "overdue" | "cancelled",
    paymentDetails?: {
      paymentMethod?: string;
      paymentId?: string;
      transactionId?: string;
      paidAt?: Date;
    },
  ) {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (paymentDetails) {
      if (paymentDetails.paymentMethod)
        updateData.paymentMethod = paymentDetails.paymentMethod;
      if (paymentDetails.paymentId)
        updateData.paymentId = paymentDetails.paymentId;
      if (paymentDetails.transactionId)
        updateData.transactionId = paymentDetails.transactionId;
      if (paymentDetails.paidAt) updateData.paidAt = paymentDetails.paidAt;
    }

    const [updated] = await db
      .update(invoices)
      .set(updateData)
      .where(eq(invoices.id, invoiceId))
      .returning();

    return updated;
  }

  // Get invoice by request ID
  async getInvoiceByRequestId(requestId: string) {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.requestId, requestId))
      .limit(1);

    return invoice;
  }

  // Update service request with invoice ID
  async linkInvoiceToService(requestId: string, invoiceId: string) {
    const [updated] = await db
      .update(serviceRequests)
      .set({ invoiceId })
      .where(eq(serviceRequests.id, requestId))
      .returning();

    return updated;
  }

  // Calculate total revenue from paid invoices (platform fees)
  async getTotalRevenue(filters?: {
    status?: "paid" | "pending" | "overdue" | "cancelled";
    startDate?: Date;
    endDate?: Date;
  }) {
    const conditions = [];

    if (filters?.status) {
      conditions.push(eq(invoices.status, filters.status));
    }

    if (filters?.startDate || filters?.endDate) {
      const dateConditions = [];
      if (filters?.startDate) {
        dateConditions.push(
          sql`${invoices.createdAt} >= ${filters.startDate.toISOString()}`,
        );
      }
      if (filters?.endDate) {
        dateConditions.push(
          sql`${invoices.createdAt} <= ${filters.endDate.toISOString()}`,
        );
      }
      conditions.push(and(...dateConditions));
    }

    const result = await db
      .select({
        totalRevenue: sql<number>`SUM(CAST(${invoices.platformFee} AS FLOAT))`,
      })
      .from(invoices)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return Number(result[0]?.totalRevenue || 0);
  }

  // Get revenue statistics with breakdowns
  async getRevenueStats() {
    // Total revenue from paid invoices (admin's platform fee)
    const totalRevenueResult = await db
      .select({
        total: sql<number>`SUM(CAST(${invoices.platformFee} AS FLOAT))`,
      })
      .from(invoices)
      .where(eq(invoices.status, "paid"));

    // Pending revenue
    const pendingRevenueResult = await db
      .select({
        pending: sql<number>`SUM(CAST(${invoices.platformFee} AS FLOAT))`,
      })
      .from(invoices)
      .where(eq(invoices.status, "pending"));

    // Total amount processed (not just platform fee)
    const totalAmountResult = await db
      .select({
        total: sql<number>`SUM(CAST(${invoices.totalAmount} AS FLOAT))`,
      })
      .from(invoices)
      .where(eq(invoices.status, "paid"));

    // Total provider earnings (what providers actually received)
    const providerEarningsResult = await db
      .select({
        total: sql<number>`SUM(CAST(${invoices.providerEarning} AS FLOAT))`,
      })
      .from(invoices)
      .where(eq(invoices.status, "paid"));

    // Invoice count by status
    const invoicesByStatus = await db
      .select({
        status: invoices.status,
        count: sql<number>`count(*)`,
      })
      .from(invoices)
      .groupBy(invoices.status);

    const statusCounts = {
      paid: 0,
      pending: 0,
      overdue: 0,
      cancelled: 0,
    };

    invoicesByStatus.forEach((item) => {
      if (item.status in statusCounts) {
        statusCounts[item.status as keyof typeof statusCounts] = Number(
          item.count,
        );
      }
    });

    return {
      totalRevenue: Number(totalRevenueResult[0]?.total || 0),
      pendingRevenue: Number(pendingRevenueResult[0]?.pending || 0),
      totalAmountProcessed: Number(totalAmountResult[0]?.total || 0),
      totalProviderEarnings: Number(providerEarningsResult[0]?.total || 0),
      invoiceCounts: statusCounts,
    };
  }

  /**
   * Extract and separate earnings from a completed service
   * Returns the breakdown of how the total amount is split between admin and provider
   */
  async extractEarningsFromService(requestId: string) {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.requestId, requestId))
      .limit(1);

    if (!invoice) {
      return null;
    }

    // Parse all monetary values from strings to numbers
    const totalAmount = parseFloat(invoice.totalAmount);
    const platformFee = parseFloat(invoice.platformFee);
    const providerEarning = parseFloat(invoice.providerEarning);
    const materialCost = parseFloat(invoice.materialCost);
    const laborCost = parseFloat(invoice.laborCost);
    const taxAmount = parseFloat(invoice.taxAmount);
    const discountAmount = parseFloat(invoice.discountAmount);
    const subTotal = parseFloat(invoice.subTotal);

    return {
      totalAmount,
      breakdown: {
        // ADMIN EARNINGS (100% of platform fee goes to admin)
        admin: {
          platformFee,
          description: "Admin commission - kept entirely by admin",
        },

        // PROVIDER EARNINGS (what provider actually receives)
        provider: {
          earning: providerEarning,
          description: "Provider's net earnings after commission",
        },

        // COST BREAKDOWN (for transparency)
        costs: {
          materialCost,
          laborCost,
          subTotal,
          taxAmount,
          discountAmount,
        },

        // VERIFICATION (should match: totalAmount = platformFee + providerEarning)
        verification: {
          formula: "totalAmount = platformFee + providerEarning",
          calculated: platformFee + providerEarning,
          actual: totalAmount,
          matches: Math.abs((platformFee + providerEarning) - totalAmount) < 0.01,
        },
      },
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        invoiceId: invoice.id,
        platformFeeRate: parseFloat(invoice.platformFeeRate),
        status: invoice.status,
      },
    };
  }

  /**
   * Get revenue distribution across all paid invoices
   * Shows how total revenue is split between admin and provider
   */
  async getRevenueDistribution(filters?: {
    status?: "paid" | "pending" | "overdue" | "cancelled";
    startDate?: Date;
    endDate?: Date;
  }) {
    const conditions = [];

    if (filters?.status) {
      conditions.push(eq(invoices.status, filters.status));
    } else {
      // Default to paid invoices
      conditions.push(eq(invoices.status, "paid"));
    }

    if (filters?.startDate || filters?.endDate) {
      const dateConditions = [];
      if (filters?.startDate) {
        dateConditions.push(
          sql`${invoices.createdAt} >= ${filters.startDate.toISOString()}`,
        );
      }
      if (filters?.endDate) {
        dateConditions.push(
          sql`${invoices.createdAt} <= ${filters.endDate.toISOString()}`,
        );
      }
      conditions.push(and(...dateConditions));
    }

    const result = await db
      .select({
        adminTotal: sql<number>`SUM(CAST(${invoices.platformFee} AS FLOAT))`,
        providerTotal: sql<number>`SUM(CAST(${invoices.providerEarning} AS FLOAT))`,
        grandTotal: sql<number>`SUM(CAST(${invoices.totalAmount} AS FLOAT))`,
        count: sql<number>`count(*)`,
      })
      .from(invoices)
      .where(and(...conditions));

    const data = result[0];
    const adminTotal = Number(data?.adminTotal || 0);
    const providerTotal = Number(data?.providerTotal || 0);
    const grandTotal = Number(data?.grandTotal || 0);
    const count = Number(data?.count || 0);

    return {
      summary: {
        adminEarnings: {
          amount: adminTotal,
          percentage: grandTotal > 0 ? (adminTotal / grandTotal) * 100 : 0,
          description: "Total platform fees collected by admin (100% kept)",
        },
        providerEarnings: {
          amount: providerTotal,
          percentage: grandTotal > 0 ? (providerTotal / grandTotal) * 100 : 0,
          description: "Total earnings paid to service providers",
        },
        totalRevenue: {
          amount: grandTotal,
          description: "Total amount processed through platform",
        },
        invoiceCount: count,
      },
      // For pie chart/frontend display
      chart: {
        labels: ["Admin Commission", "Provider Earnings"],
        data: [adminTotal, providerTotal],
        percentages: [
          grandTotal > 0 ? ((adminTotal / grandTotal) * 100).toFixed(2) : "0.00",
          grandTotal > 0 ? ((providerTotal / grandTotal) * 100).toFixed(2) : "0.00",
        ],
      },
    };
  }
}

export const invoiceRepository = new InvoiceRepository();
