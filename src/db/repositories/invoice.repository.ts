import db from "#db/index.js";
import { invoiceLineItems, invoices, serviceRequests } from "#db/schema.js";
import { and, eq } from "drizzle-orm";

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
}

export const invoiceRepository = new InvoiceRepository();
