import { Request, Response } from "express";
import { invoiceRepository } from "#db/repositories/invoice.repository.js";
import { paymentRepository } from "#db/repositories/payment.repository.js";
import { stripeService } from "#drizzleServices/stripe.service.js";

// Payment configuration
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || "";

// Utility functions
function toSmallestCurrencyUnit(amount: number): number {
  return Math.round(amount * 100);
}

function validateAmount(amount: number): { valid: boolean; error?: string } {
  if (isNaN(amount)) {
    return { valid: false, error: "Amount must be a number" };
  }
  if (amount < 100) {
    return { valid: false, error: "Minimum amount is ₹1.00" };
  }
  if (amount > 10000000) {
    return { valid: false, error: "Maximum amount is ₹100,000.00" };
  }
  return { valid: true };
}

export const createPaymentIntent = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user.id;
    const { invoiceId } = req.body;

    if (!invoiceId) {
      res.status(400).json({
        message: "Invoice ID is required",
        success: false,
      });
      return;
    }

    // Get invoice details
    const invoice = await invoiceRepository.getInvoiceById(invoiceId);
    if (!invoice) {
      res.status(404).json({
        message: "Invoice not found",
        success: false,
      });
      return;
    }

    // Verify invoice belongs to customer
    if (invoice.customerId !== customerId) {
      res.status(403).json({
        message: "Access denied. This invoice does not belong to you.",
        success: false,
      });
      return;
    }

    // Check if payment method is cash - online payments not needed
    if (invoice.paymentMethod === "cash") {
      res.status(400).json({
        message: "This invoice was paid with cash. Online payment not required.",
        success: false,
      });
      return;
    }

    // Check if invoice is already paid
    if (invoice.status === "paid") {
      res.status(400).json({
        message: "Invoice is already paid",
        success: false,
      });
      return;
    }

    // Check if there's a successful payment already
    const hasSuccessfulPayment = await paymentRepository.hasSuccessfulPayment(
      invoiceId
    );
    if (hasSuccessfulPayment) {
      res.status(400).json({
        message: "Payment already completed for this invoice",
        success: false,
      });
      return;
    }

    // Check if there's already a pending/intiated payment for this invoice
    const existingPayments = await paymentRepository.getPaymentsByInvoice(invoiceId);
    const pendingPayment = existingPayments.find(
      (p: any) => p.status === "initiated" || p.status === "processing"
    );

    if (pendingPayment) {
      if (pendingPayment.gatewayOrderId) {
        console.log("Found existing payment, retrieving from stripe:", pendingPayment.gatewayOrderId);

        const stripeResult = await stripeService.retrievePaymentIntent(
          pendingPayment.gatewayOrderId
        )

        if (stripeResult.success && stripeResult.clientSecret) {
          res.status(200).json({
            message: "Payment already initiated",
            success: true,
            data: {
              paymentId: pendingPayment.id,
              clientSecret: stripeResult.clientSecret,
              paymentIntentId: stripeResult.paymentIntentId,
              amount: pendingPayment.amount,
              currency: pendingPayment.currency || "INR",
              status: pendingPayment.status || stripeResult.status,
              publishableKey: STRIPE_PUBLISHABLE_KEY,
            }
          })
        } else {
          // stripe retrieval failed - create new payment intent
          console.error("Failed to retrieve from stripe: ", stripeResult.error);
        }
        
      }
    }

    // Get total amount from invoice
    const totalAmount = parseFloat(invoice.totalAmount);

    // Validate amount
    const amountInPaise = toSmallestCurrencyUnit(totalAmount);
    const validation = validateAmount(amountInPaise);
    if (!validation.valid) {
      res.status(400).json({
        message: validation.error,
        success: false,
      });
      return;
    }

    // Create payment intent with Stripe (with idempotency key to prevent duplicates)
    const result = await stripeService.createPaymentIntent({
      amount: amountInPaise,
      currency: "inr",
      invoiceId: invoice.id,
      customerId: customerId,
      description: `Payment for invoice ${invoice.invoiceNumber}`,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        customerEmail: (req as any).user.email,
      },
    }, invoice.id); // Use invoice ID as idempotency key

    if (!result.success) {
      res.status(500).json({
        message: result.error || "Failed to create payment intent",
        success: false,
      });
      return;
    }

    // Create payment record with duplicate check
    const payment = await paymentRepository.createPaymentWithDuplicateCheck({
      invoiceId: invoice.id,
      gateway: "stripe",
      gatewayOrderId: result.paymentIntentId,
      amount: totalAmount.toString(),
      currency: "INR",
      status: "initiated",
      clientIp: req.ip,
      userAgent: req.get("user-agent"),
      metadata: {
        customerId,
        invoiceNumber: invoice.invoiceNumber,
      },
    });

    res.status(200).json({
      message: "Payment intent created successfully",
      success: true,
      data: {
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntentId,
        amount: totalAmount,
        currency: result.currency,
        paymentId: payment.id,
        publishableKey: STRIPE_PUBLISHABLE_KEY,
      },
    });
    return;
  } catch (error: any) {
    console.error("Create Payment Intent Error:", error);
    res.status(500).json({
      message: error.message || "Failed to create payment intent",
      success: false,
    });
    return;
  }
};

/**
 * Confirm payment (webhook or manual confirmation)
 * POST /api/payments/confirm
 */
export const confirmPayment = async (req: Request, res: Response) => {
  try {
    const { paymentId, paymentIntentId } = req.body;

    if (!paymentId || !paymentIntentId) {
      res.status(400).json({
        message: "Payment ID and Payment Intent ID are required",
        success: false,
      });
      return;
    }

    // Get payment record
    const payment = await paymentRepository.getPaymentById(paymentId);
    if (!payment) {
      res.status(404).json({
        message: "Payment not found",
        success: false,
      });
      return;
    }

    // Fetch payment intent from Stripe
    const result = await stripeService.getPaymentIntent(paymentIntentId);

    if (!result.success || !result.data) {
      res.status(500).json({
        message: result.error || "Failed to fetch payment details",
        success: false,
      });
      return;
    }

    const paymentIntent = result.data;

    // Update payment based on status
    let updatedPayment;
    if (paymentIntent.status === "succeeded") {
      updatedPayment = await paymentRepository.updatePaymentStatus(
        paymentId,
        "completed",
        {
          gatewayPaymentId: paymentIntentId,
          gatewayResponse: paymentIntent,
          completedAt: new Date(),
        }
      );

      // Update invoice status to paid
      await invoiceRepository.updateInvoiceStatus(
        payment.invoiceId,
        "paid",
        {
          paymentMethod: (paymentIntent as any).payment_method_types?.[0] || "card",
          paymentId: paymentIntentId,
          transactionId: paymentIntentId,
          paidAt: new Date(),
        }
      );
    } else if (paymentIntent.status === "canceled") {
      updatedPayment = await paymentRepository.updatePaymentStatus(
        paymentId,
        "cancelled"
      );
    } else if (paymentIntent.status === "requires_payment_method") {
      updatedPayment = await paymentRepository.updatePaymentStatus(
        paymentId,
        "failed",
        {
          failureReason: "Payment failed",
          failedAt: new Date(),
        }
      );
    }

    res.status(200).json({
      message: "Payment status updated successfully",
      success: true,
      data: {
        payment: updatedPayment,
        stripeStatus: paymentIntent.status,
      },
    });
    return;
  } catch (error: any) {
    console.error("Confirm Payment Error:", error);
    res.status(500).json({
      message: error.message || "Failed to confirm payment",
      success: false,
    });
    return;
  }
};

/**
 * Get payment status
 * GET /api/payments/:paymentId/status
 */
export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const paymentIdValue = Array.isArray(paymentId) ? paymentId[0] : paymentId;

    if (!paymentIdValue) {
      res.status(400).json({
        message: "Payment ID is required",
        success: false,
      });
      return;
    }

    const payment = await paymentRepository.getPaymentById(paymentIdValue);

    if (!payment) {
      res.status(404).json({
        message: "Payment not found",
        success: false,
      });
      return;
    }

    res.status(200).json({
      message: "Payment status retrieved successfully",
      success: true,
      data: {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        gateway: payment.gateway,
        initiatedAt: payment.initiatedAt,
        completedAt: payment.completedAt,
        failedAt: payment.failedAt,
        failureReason: payment.failureReason,
      },
    });
    return;
  } catch (error: any) {
    console.error("Get Payment Status Error:", error);
    res.status(500).json({
      message: error.message || "Failed to get payment status",
      success: false,
    });
    return;
  }
};

/**
 * Get payment history for customer
 * GET /api/payments/history
 */
export const getPaymentHistory = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await paymentRepository.getAllPayments(
      {},
      { page, limit }
    );

    // Filter payments to only show this customer's payments
    // (This requires joining with invoices table - for now showing all)

    res.status(200).json({
      message: "Payment history retrieved successfully",
      success: true,
      data: {
        payments: result.payments,
        pagination: {
          currentPage: page,
          totalPages: result.totalPages,
          total: result.total,
          limit,
          hasNext: page < result.totalPages,
          hasPrev: page > 1,
        },
      },
    });
    return;
  } catch (error: any) {
    console.error("Get Payment History Error:", error);
    res.status(500).json({
      message: error.message || "Failed to get payment history",
      success: false,
    });
    return;
  }
};

/**
 * Get payment statistics (Admin only)
 * GET /api/payments/stats
 */
export const getPaymentStats = async (req: Request, res: Response) => {
  try {
    const stats = await paymentRepository.getPaymentStats();

    res.status(200).json({
      message: "Payment statistics retrieved successfully",
      success: true,
      data: stats,
    });
    return;
  } catch (error: any) {
    console.error("Get Payment Stats Error:", error);
    res.status(500).json({
      message: error.message || "Failed to get payment statistics",
      success: false,
    });
    return;
  }
};

/**
 * Cancel payment intent
 * POST /api/payments/cancel
 */
export const cancelPayment = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.body;

    if (!paymentId) {
      res.status(400).json({
        message: "Payment ID is required",
        success: false,
      });
      return;
    }

    const payment = await paymentRepository.getPaymentById(paymentId);
    if (!payment) {
      res.status(404).json({
        message: "Payment not found",
        success: false,
      });
      return;
    }

    // Can only cancel initiated payments
    if (payment.status !== "initiated") {
      res.status(400).json({
        message: "Can only cancel initiated payments",
        success: false,
      });
      return;
    }

    // Cancel with Stripe if we have an order ID
    if (payment.gatewayOrderId) {
      const result = await stripeService.cancelPaymentIntent(
        payment.gatewayOrderId
      );

      if (!result.success) {
        res.status(500).json({
          message: result.error || "Failed to cancel payment with gateway",
          success: false,
        });
        return;
      }
    }

    // Update payment status
    await paymentRepository.updatePaymentStatus(paymentId, "cancelled");

    res.status(200).json({
      message: "Payment cancelled successfully",
      success: true,
    });
    return;
  } catch (error: any) {
    console.error("Cancel Payment Error:", error);
    res.status(500).json({
      message: error.message || "Failed to cancel payment",
      success: false,
    });
    return;
  }
};
