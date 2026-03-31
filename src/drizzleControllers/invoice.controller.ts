import { invoiceRepository } from "#db/repositories/invoice.repository.js";
import { Request, Response } from "express";
import db from "#db/index.js";
import { customers, serviceRequests, serviceProviders } from "#db/schema.js";
import { eq } from "drizzle-orm";

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

    res.status(200).json({
      data: invoices,
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

    const updated = await invoiceRepository.updateInvoiceStatus(
      idValue,
      "paid",
      {
        paymentMethod: paymentMethod || "upi",
        paymentId,
        transactionId,
        paidAt: new Date(),
      },
    );

    res.status(200).json({
      message: "Payment received successfully",
      success: true,
      data: updated,
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
