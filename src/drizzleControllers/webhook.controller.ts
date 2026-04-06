import { Request, Response } from "express";
import { invoiceRepository } from "#db/repositories/invoice.repository.js";
import { paymentRepository } from "#db/repositories/payment.repository.js";
import { refundRepository } from "#db/repositories/refund.repository.js";
import { stripeService } from "#drizzleServices/stripe.service.js";

export const handleStripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    res.status(400).json({
      message: "Stripe signature or webhook secret missing",
      success: false,
    });
    return;
  }

  try {
    // Use raw body for signature verification
    const rawBody = (req as any).rawBody;

    if (!rawBody) {
      res.status(400).json({
        message: "Raw body not found",
        success: false,
      });
      return;
    }

    // Verify webhook signature with raw body
    const isValid = stripeService.verifyWebhookSignature(rawBody, sig);

    if (!isValid) {
      res.status(400).json({
        message: "Invalid webhook signature",
        success: false,
      });
      return;
    }

    // Construct webhook event with raw body
    const result = stripeService.constructWebhookEvent(
      rawBody,
      sig,
      webhookSecret,
    );

    if (!result.success || !result.event) {
      res.status(400).json({
        message: "Failed to construct webhook event",
        success: false,
      });
      return;
    }

    const event = result.event;

    console.log(`Stripe webhook received: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentSuccess(event.data.object as any);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailure(event.data.object as any);
        break;

      case "payment_intent.created":
        await handlePaymentIntentCreated(event.data.object as any);
        break;

      case "charge.succeeded":
        await handleChargeSucceeded(event.data.object as any);
        break;

      case "charge.updated":
        await handleChargeUpdated(event.data.object as any);
        break;

      case "charge.refund.updated":
        await handleRefundUpdate(event.data.object as any);
        break;

      case "charge.refunded":
        await handleRefundProcessed(event.data.object as any);
        break;

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }

    res.status(200).json({
      message: "Webhook processed successfully",
      success: true,
      received: true,
    });
    return;
  } catch (error: any) {
    console.error("Stripe webhook error:", error);
    res.status(500).json({
      message: error.message || "Failed to process webhook",
      success: false,
    });
    return;
  }
};

async function handlePaymentSuccess(paymentIntent: any) {
  try {
    console.log(`Processing payment success: ${paymentIntent.id}`);
    console.log(`   Amount: ${paymentIntent.amount / 100} ${paymentIntent.currency.toUpperCase()}`);
    console.log(`   Invoice ID from metadata: ${paymentIntent.metadata?.invoiceId}`);
    console.log(`   Customer ID from metadata: ${paymentIntent.metadata?.customerId}`);

    // Find payment by gateway order ID
    const payment = await paymentRepository.getPaymentByOrderId(
      paymentIntent.id,
    );

    if (!payment) {
      console.error(`❌ Payment not found for order ID: ${paymentIntent.id}`);
      console.error(`   This usually means the payment record was not created in the database`);
      console.error(`   when the Stripe payment intent was created.`);

      // Try to find by invoice ID as fallback
      if (paymentIntent.metadata?.invoiceId) {
        console.log(`   Attempting to find payment by invoice ID: ${paymentIntent.metadata.invoiceId}`);
        const invoicePayments = await paymentRepository.getPaymentsByInvoice(paymentIntent.metadata.invoiceId);
        console.log(`   Found ${invoicePayments.length} payment(s) for this invoice`);

        if (invoicePayments.length > 0) {
          const latestPayment = invoicePayments[0]; // Get the most recent payment
          console.log(`   Updating latest payment: ${latestPayment.id} with order ID: ${paymentIntent.id}`);

          // Update this payment with the correct order ID
          await paymentRepository.updatePaymentStatus(latestPayment.id, "completed", {
            gatewayPaymentId: paymentIntent.id,
            gatewayResponse: paymentIntent,
            completedAt: new Date(paymentIntent.created * 1000),
          });

          // Update invoice status
          await invoiceRepository.updateInvoiceStatus(latestPayment.invoiceId, "paid", {
            paymentMethod: paymentIntent.payment_method_types[0] || "card",
            paymentId: paymentIntent.id,
            transactionId: paymentIntent.charges?.data[0]?.id || paymentIntent.id,
            paidAt: new Date(),
          });

          console.log(`✓ Payment ${latestPayment.id} marked as completed (fallback method)`);
          return;
        }
      }

      console.error(`   No payment found. Cannot complete payment.`);
      return;
    }

    // Skip if already completed
    if (payment.status === "completed") {
      console.log(`✓ Payment already completed: ${payment.id}`);
      return;
    }

    // Update payment status
    await paymentRepository.updatePaymentStatus(payment.id, "completed", {
      gatewayPaymentId: paymentIntent.id,
      gatewayResponse: paymentIntent,
      completedAt: new Date(
        paymentIntent.created * 1000,
      ) /* Convert Unix timestamp */,
    });

    // Update invoice status
    await invoiceRepository.updateInvoiceStatus(payment.invoiceId, "paid", {
      paymentMethod: paymentIntent.payment_method_types[0] || "card",
      paymentId: paymentIntent.id,
      transactionId: paymentIntent.charges?.data[0]?.id || paymentIntent.id,
      paidAt: new Date(),
    });

    console.log(`✓ Payment ${payment.id} marked as completed`);
    console.log(`✓ Invoice ${payment.invoiceId} marked as paid`);
  } catch (error: any) {
    console.error("Error handling payment success:", error);
    throw error;
  }
}

async function handlePaymentFailure(paymentIntent: any) {
  try {
    console.log(`Processing payment failure: ${paymentIntent.id}`);

    // Find payment by gateway order ID
    const payment = await paymentRepository.getPaymentByOrderId(
      paymentIntent.id,
    );

    if (!payment) {
      console.error(`Payment not found for order ID: ${paymentIntent.id}`);
      return;
    }

    // Update payment status to failed
    await paymentRepository.updatePaymentStatus(payment.id, "failed", {
      gatewayPaymentId: paymentIntent.id,
      gatewayResponse: paymentIntent,
      failureReason:
        paymentIntent.last_payment_error?.message || "Payment failed",
      failedAt: new Date(),
    });

    console.log(`Payment ${payment.id} marked as failed`);
  } catch (error: any) {
    console.error("Error handling payment failure:", error);
    throw error;
  }
}

async function handleRefundUpdate(charge: any) {
  try {
    console.log(`Processing refund update: ${charge.id}`);

    // Find payment by charge ID (transaction ID)
    const payments = await paymentRepository.getAllPayments({});
    const payment = payments.payments.find(
      (p: any) => p.gatewayPaymentId === charge.payment_intent,
    );

    if (!payment) {
      console.error(`Payment not found for charge: ${charge.id}`);
      return;
    }

    // Get or create refund record
    let refund = await refundRepository.getRefundByGatewayId(charge.id);

    if (!refund && charge.refunded) {
      // Create new refund record
      const refundAmount = charge.amount_refunded || charge.amount;

      refund = await refundRepository.createRefund({
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        refundId: charge.id,
        amount: (refundAmount / 100).toString(), // Convert from paise
        reason: "Refund processed",
        status: "completed",
        gatewayResponse: charge,
      });

      console.log(`Refund ${refund.id} created for payment ${payment.id}`);
    } else if (refund) {
      // Update existing refund
      await refundRepository.updateRefundStatus(refund.id, "completed", {
        gatewayResponse: charge,
        completedAt: new Date(),
      });

      console.log(`Refund ${refund.id} updated to completed`);
    }
  } catch (error: any) {
    console.error("Error handling refund update:", error);
    throw error;
  }
}

async function handleRefundProcessed(charge: any) {
  try {
    console.log(`Processing fully refunded charge: ${charge.id}`);

    // Similar to refund update, but ensures full refund is tracked
    await handleRefundUpdate(charge);
  } catch (error: any) {
    console.error("Error handling refund processed:", error);
    throw error;
  }
}

async function handlePaymentIntentCreated(paymentIntent: any) {
  try {
    console.log(`Payment intent created: ${paymentIntent.id}`);

    // Log the creation but don't take any action
    // The payment record should already exist from when we created the intent
    const payment = await paymentRepository.getPaymentByOrderId(paymentIntent.id);

    if (!payment) {
      console.warn(`⚠️ Payment record not found for newly created intent: ${paymentIntent.id}`);
      console.warn(`   Invoice ID from metadata: ${paymentIntent.metadata?.invoiceId}`);
      console.warn(`   This could indicate a race condition or missing payment creation`);
    } else {
      console.log(`✓ Payment record found for intent: ${paymentIntent.id}`);
    }
  } catch (error: any) {
    console.error("Error handling payment intent created:", error);
    // Don't throw - this is just informational
  }
}

async function handleChargeSucceeded(charge: any) {
  try {
    console.log(`Charge succeeded: ${charge.id}`);

    // Charge succeeded is usually followed by payment_intent.succeeded
    // We don't need to take action here as payment_intent.succeeded will handle it
    const paymentIntentId = charge.payment_intent;
    console.log(`   Associated payment intent: ${paymentIntentId}`);
  } catch (error: any) {
    console.error("Error handling charge succeeded:", error);
    // Don't throw - this is just informational
  }
}

async function handleChargeUpdated(charge: any) {
  try {
    console.log(`Charge updated: ${charge.id}`);

    // Log charge updates but don't take action
    // The payment_intent.succeeded event will handle the actual payment completion
    console.log(`   Charge status: ${charge.status}`);
    console.log(`   Payment intent: ${charge.payment_intent}`);
  } catch (error: any) {
    console.error("Error handling charge updated:", error);
    // Don't throw - this is just informational
  }
}
