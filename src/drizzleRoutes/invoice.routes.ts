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

// Other invoice routes - SPECIFIC routes must come BEFORE parameterized routes
router.get("/request/:requestId", getInvoicesByRequestId);
router.get("/number/:invoiceNumber", getInvoiceByNumber);
router.post("/:id/pay", markInvoicesPaid);
router.get("/:id", getInvoiceById);

export default router;
