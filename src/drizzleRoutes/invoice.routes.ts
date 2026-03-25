import {
  getCustomerInvoices,
  getInvoiceById,
  getInvoiceByNumber,
  getInvoicesByRequestId,
  getProviderInvoices,
  markInvoicesPaid,
} from "#drizzleControllers/invoice.controller.js";
import { drizzleAuthMiddleware } from "#middlewares/drizzleAuth.middleware.js";
import express from "express";

const router = express.Router();

// Get invoices for authenticated customer
router.get(
  "/customer/my-invoices",
  drizzleAuthMiddleware(["customer"]),
  getCustomerInvoices,
);
router.get(
  "/provider/my-invoices",
  drizzleAuthMiddleware(["serviceProvider"]),
  getProviderInvoices,
);

// Other invoice routes
router.get("/:id", getInvoiceById);
router.get("/number/:invoiceNumber", getInvoiceByNumber);
router.get("/request/:requestId", getInvoicesByRequestId);
router.post("/:id/pay", markInvoicesPaid);

export default router;
