import { invoiceRepository } from "#db/repositories/invoice.repository.js";
import { paymentRepository } from "#db/repositories/payment.repository.js";
import { serviceRequestRepository } from "#db/repositories/serviceRequests.repository.js";
import { Request, Response } from "express";
import db from "#db/index.js";
import { customers, serviceProviders, serviceRequests } from "#db/schema.js";
import { eq, inArray } from "drizzle-orm";

export const getInvoiceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const idValue = Array.isArray(id) ? id[0] : id;

    const invoice = await invoiceRepository.getInvoiceWithLineItems(idValue);

    if (!invoice) {
      res.status(404).json({
        message: "Invoice not found",
        success: false,
      });
      return;
    }

    // Fetch customer details
    let customer = null;
    if (invoice.customerId) {
      const [customerData] = await db
        .select({
          id: customers.id,
          name: customers.name,
          email: customers.email,
          phone: customers.phone,
        })
        .from(customers)
        .where(eq(customers.id, invoice.customerId))
        .limit(1);

      customer = customerData;
    }

    // Fetch service request details
    let serviceRequest = null;
    if (invoice.requestId) {
      const [requestData] = await db
        .select({
          id: serviceRequests.id,
          title: serviceRequests.serviceTitle,
          serviceType: serviceRequests.serviceType,
          serviceDescription: serviceRequests.serviceDescription,
          schedule: serviceRequests.schedule,
          serviceAddress: serviceRequests.serviceAddress,
        })
        .from(serviceRequests)
        .where(eq(serviceRequests.id, invoice.requestId))
        .limit(1);

      serviceRequest = requestData;
    }

    // Fetch service provider details
    let serviceProvider = null;
    if (invoice.serviceProviderId) {
      const [providerData] = await db
        .select({
          id: serviceProviders.id,
          name: serviceProviders.name,
        })
        .from(serviceProviders)
        .where(eq(serviceProviders.id, invoice.serviceProviderId))
        .limit(1);

      serviceProvider = providerData;
    }

    res.status(200).json({
      data: {
        ...invoice,
        customer,
        serviceRequest,
        serviceProvider,
      },
      success: true,
    });
    return;
  } catch (error: any) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({
      message: error.message || "Failed to fetch invoice",
      success: false,
    });
  }
};

export const getInvoiceByNumber = async (req: Request, res: Response) => {
  try {
    const { invoiceNumber } = req.params;
    const invoiceNumberValue = Array.isArray(invoiceNumber)
      ? invoiceNumber[0]
      : invoiceNumber;

    const invoice =
      await invoiceRepository.getInvoiceByNumber(invoiceNumberValue);

    if (!invoice) {
      res.status(404).json({
        message: "Invoice not found",
        success: false,
      });
      return;
    }

    const invoiceWithItems = await invoiceRepository.getInvoiceWithLineItems(
      invoice.id,
    );

    if (!invoiceWithItems) {
      res.status(404).json({
        message: "Invoice not found",
        success: false,
      });
      return;
    }

    // Fetch customer details
    let customer = null;
    if (invoiceWithItems.customerId) {
      const [customerData] = await db
        .select({
          id: customers.id,
          name: customers.name,
          email: customers.email,
          phone: customers.phone,
        })
        .from(customers)
        .where(eq(customers.id, invoiceWithItems.customerId))
        .limit(1);

      customer = customerData;
    }

    // Fetch service request details
    let serviceRequest = null;
    if (invoiceWithItems.requestId) {
      const [requestData] = await db
        .select({
          id: serviceRequests.id,
          title: serviceRequests.serviceTitle,
          serviceType: serviceRequests.serviceType,
          serviceDescription: serviceRequests.serviceDescription,
          schedule: serviceRequests.schedule,
          serviceAddress: serviceRequests.serviceAddress,
        })
        .from(serviceRequests)
        .where(eq(serviceRequests.id, invoiceWithItems.requestId))
        .limit(1);

      serviceRequest = requestData;
    }

    // Fetch service provider details
    let serviceProvider = null;
    if (invoiceWithItems.serviceProviderId) {
      const [providerData] = await db
        .select({
          id: serviceProviders.id,
          name: serviceProviders.name,
        })
        .from(serviceProviders)
        .where(eq(serviceProviders.id, invoiceWithItems.serviceProviderId))
        .limit(1);

      serviceProvider = providerData;
    }

    res.status(200).json({
      data: {
        ...invoiceWithItems,
        customer,
        serviceRequest,
        serviceProvider,
      },
      success: true,
    });
    return;
  } catch (error: any) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch invoice",
    });
    return;
  }
};

export const getCustomerInvoices = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user.id;
    const { status } = req.query;

    let invoices = await invoiceRepository.getInvoicesByCustomer(customerId);

    if (status) {
      invoices = invoices.filter((inv: any) => inv.status === status);
    }

    res.status(200).json({
      data: invoices,
      success: true,
    });
    return;
  } catch (error: any) {
    console.error("Error fetching customer invoices:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch invoices",
    });
    return;
  }
};

export const getProviderInvoices = async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).user.id;
    const { status } = req.query;

    let invoices = await invoiceRepository.getInvoicesByProvider(providerId);

    if (status) {
      invoices = invoices.filter((inv: any) => inv.status === status);
    }

    // Fetch service requests to get service titles
    const serviceRequestIds = invoices.map((inv: any) => inv.requestId);
    const serviceRequests = await serviceRequestRepository.findByIds(serviceRequestIds);

    // Create a map of request ID to service title
    const serviceTitleMap = new Map();
    serviceRequests.forEach((req: any) => {
      if (req) {
        serviceTitleMap.set(req.id, {
          serviceTitle: req.serviceTitle,
          serviceType: req.serviceType,
        });
      }
    });

    // Add service information to each invoice
    const enrichedInvoices = invoices.map((invoice: any) => ({
      ...invoice,
      service: serviceTitleMap.get(invoice.requestId) || {
        serviceTitle: "Unknown Service",
        serviceType: "unknown",
      },
    }));

    res.status(200).json({
      data: enrichedInvoices,
      success: true,
    });
  } catch (error: any) {
    console.error("Error fetching provider invoices:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch invoices",
    });
    return;
  }
};

export const markInvoicesPaid = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const idValue = Array.isArray(id) ? id[0] : id;
    const { paymentMethod, paymentId, transactionId } = req.body;

    const invoice = await invoiceRepository.getInvoiceById(idValue);
    if (!invoice) {
      res.status(404).json({
        message: "Invoice not found",
        success: false,
      });
      return;
    }

    if (invoice.status === "paid") {
      res.status(400).json({
        message: "Invoic is already paid",
        success: false,
      });
      return;
    }

    // Check if payment record already exists for this invoice
    const existingPayments = await paymentRepository.getPaymentsByInvoice(idValue);
    if (existingPayments && existingPayments.length > 0) {
      res.status(400).json({
        message: "Payment record already exists for this invoice",
        success: false,
      });
      return;
    }

    // Create payment record in the payments table
    const payment = await paymentRepository.createPayment({
      invoiceId: idValue,
      gateway: paymentMethod?.toLowerCase() || "manual",
      gatewayOrderId: transactionId || paymentId || `manual_${Date.now()}`,
      amount: invoice.totalAmount,
      currency: "INR",
      status: "completed",
      clientIp: req.ip,
      userAgent: req.get("user-agent"),
      metadata: {
        paymentMethod: paymentMethod || "upi",
        transactionId,
        manualPayment: true,
      },
    });

    // Update payment status to completed with gateway details
    await paymentRepository.updatePaymentStatus(payment.id, "completed", {
      gatewayPaymentId: transactionId || paymentId,
      gatewayResponse: {
        paymentMethod,
        transactionId,
        manualPayment: true,
      },
      completedAt: new Date(),
    });

    // Update invoice status to paid
    const updated = await invoiceRepository.updateInvoiceStatus(
      idValue,
      "paid",
      {
        paymentMethod: paymentMethod || "upi",
        paymentId: payment.id,
        transactionId,
        paidAt: new Date(),
      },
    );

    res.status(200).json({
      message: "Payment received successfully",
      success: true,
      data: {
        invoice: updated,
        payment: {
          id: payment.id,
          amount: payment.amount,
          status: payment.status,
          paymentMethod,
          transactionId,
        },
      },
    });
  } catch (error: any) {
    console.error("Error recording payment:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to record payment",
    });
    return;
  }
};

export const getInvoicesByRequestId = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const requestIdValue = Array.isArray(requestId) ? requestId[0] : requestId;

    const invoice =
      await invoiceRepository.getInvoiceByRequestId(requestIdValue);

    if (!invoice) {
      res.status(404).json({
        message: "Invoice not found for this request",
        success: false,
      });
      return;
    }

    const invoiceWithItems = await invoiceRepository.getInvoiceWithLineItems(
      invoice.id,
    );

    if (!invoiceWithItems) {
      res.status(404).json({
        message: "Invoice not found for this request",
        success: false,
      });
      return;
    }

    // Fetch customer details
    let customer = null;
    if (invoiceWithItems.customerId) {
      const [customerData] = await db
        .select({
          id: customers.id,
          name: customers.name,
          email: customers.email,
          phone: customers.phone,
        })
        .from(customers)
        .where(eq(customers.id, invoiceWithItems.customerId))
        .limit(1);

      customer = customerData;
    }

    // Fetch service request details
    let serviceRequest = null;
    if (invoiceWithItems.requestId) {
      const [requestData] = await db
        .select({
          id: serviceRequests.id,
          title: serviceRequests.serviceTitle,
          serviceType: serviceRequests.serviceType,
          serviceDescription: serviceRequests.serviceDescription,
          schedule: serviceRequests.schedule,
          serviceAddress: serviceRequests.serviceAddress,
        })
        .from(serviceRequests)
        .where(eq(serviceRequests.id, invoiceWithItems.requestId))
        .limit(1);

      serviceRequest = requestData;
    }

    // Fetch service provider details
    let serviceProvider = null;
    if (invoiceWithItems.serviceProviderId) {
      const [providerData] = await db
        .select({
          id: serviceProviders.id,
          name: serviceProviders.name,
        })
        .from(serviceProviders)
        .where(eq(serviceProviders.id, invoiceWithItems.serviceProviderId))
        .limit(1);

      serviceProvider = providerData;
    }

    res.status(200).json({
      data: {
        ...invoiceWithItems,
        customer,
        serviceRequest,
        serviceProvider,
      },
      success: true,
    });
  } catch (error: any) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch invoice",
    });
    return
  }
};

export const getAllInvoices = async (req: Request, res: Response) => {
  try {
    // Build filters object from query params
    const filters: any = {};

    if (req.query.customerId) {
      filters.customerId = req.query.customerId;
    }

    if (req.query.serviceProviderId) {
      filters.serviceProviderId = req.query.serviceProviderId;
    }

    if (req.query.status) {
      filters.status = req.query.status;
    }

    if (req.query.invoiceNumber) {
      filters.invoiceNumber = req.query.invoiceNumber;
    }

    if (req.query.startDate) {
      filters.startDate = new Date(req.query.startDate as string);
    }

    if (req.query.endDate) {
      filters.endDate = new Date(req.query.endDate as string);
    }

    // Build pagination object from query params
    const pagination: any = {};
    if (req.query.page) {
      pagination.page = parseInt(req.query.page as string);
    }
    if (req.query.limit) {
      pagination.limit = parseInt(req.query.limit as string);
    }

    // Build sort object from query params
    const sort: any = {};
    if (req.query.sortField) {
      sort.field = req.query.sortField;
    }
    if (req.query.sortOrder) {
      sort.order = req.query.sortOrder;
    }

    const result = await invoiceRepository.getAllInvoices({
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      pagination: Object.keys(pagination).length > 0 ? pagination : undefined,
      sort: Object.keys(sort).length > 0 ? sort : undefined,
    });

    res.status(200).json({
      data: result.invoices,
      pagination: result.pagination,
      success: true,
    });
    return;
  } catch (error: any) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch invoices",
    });
    return;
  }
}
