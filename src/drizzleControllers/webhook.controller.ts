import { Request, Response } from "express";
import { invoiceRepository } from "#db/repositories/invoice.repository.js";
import { paymentRepository } from "#db/repositories/payment.repository.js";
import { refundRepository } from "#db/repositories/refund.repository.js";
import { stripeService } from "#drizzleServices/stripe.service.js";

export const handleStripeWebhook = async (req: Request, res: Response) => {
  console.log("\n========== STRIPE WEBHOOK START ==========");
  console.log("🔔 [WEBHOOK] Webhook received at:", new Date().toISOString());
  console.log("🔔 [WEBHOOK] Environment:", process.env.NODE_ENV);

  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  console.log("🔔 [WEBHOOK] Stripe signature present:", !!sig);
  console.log("🔔 [WEBHOOK] Webhook secret configured:", !!webhookSecret);

  if (!sig || !webhookSecret) {
    console.error("❌ [WEBHOOK] Stripe signature or webhook secret missing");
    res.status(400).json({
      message: "Stripe signature or webhook secret missing",
      success: false,
    });
    return;
  }

  try {
    // Use raw body for signature verification
    const rawBody = (req as any).rawBody;

    console.log("🔔 [WEBHOOK] Raw body present:", !!rawBody);
    console.log("🔔 [WEBHOOK] Raw body type:", typeof rawBody);
    console.log("🔔 [WEBHOOK] Raw body length:", rawBody?.length || 0);

    if (!rawBody) {
      console.error("❌ [WEBHOOK] Raw body not found - this is a Vercel serverless issue");
      console.error("❌ [WEBHOOK] req.body type:", typeof req.body);
      console.error("❌ [WEBHOOK] req.body keys:", Object.keys(req.body || {}));
      res.status(400).json({
        message: "Raw body not found",
        success: false,
      });
      return;
    }

    // Verify webhook signature with raw body
    console.log("🔔 [WEBHOOK] Verifying webhook signature...");
    const isValid = stripeService.verifyWebhookSignature(rawBody, sig);

    if (!isValid) {
      console.error("❌ [WEBHOOK] Invalid webhook signature");
      res.status(400).json({
        message: "Invalid webhook signature",
        success: false,
      });
      return;
    }

    console.log("✅ [WEBHOOK] Webhook signature verified successfully");

    // Construct webhook event with raw body
    console.log("🔔 [WEBHOOK] Constructing webhook event...");
    const result = stripeService.constructWebhookEvent(
      rawBody,
      sig,
      webhookSecret,
    );

    if (!result.success || !result.event) {
      console.error("❌ [WEBHOOK] Failed to construct webhook event:", result.error);
      res.status(400).json({
        message: "Failed to construct webhook event",
        success: false,
      });
      return;
    }

    const event = result.event;

    console.log("🎉 [WEBHOOK] Event constructed successfully");
    console.log("📝 [WEBHOOK] Event type:", event.type);
    console.log("📝 [WEBHOOK] Event ID:", event.id);
    console.log("📝 [WEBHOOK] Created:", new Date(event.created * 1000).toISOString());

    // Handle different event types
    console.log("🔔 [WEBHOOK] Processing event type:", event.type);

    try {
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
          console.log(`ℹ️ [WEBHOOK] Unhandled webhook event type: ${event.type}`);
      }

      console.log("✅ [WEBHOOK] Event processed successfully");
      console.log("========== STRIPE WEBHOOK END ==========\n");

      res.status(200).json({
        message: "Webhook processed successfully",
        success: true,
        received: true,
      });
      return;
    } catch (handlerError: any) {
      console.error("❌ [WEBHOOK] Error in event handler:", handlerError);
      console.error("❌ [WEBHOOK] Handler error message:", handlerError.message);
      console.error("❌ [WEBHOOK] Handler error stack:", handlerError.stack);
      console.log("========== STRIPE WEBHOOK END (WITH ERROR) ==========\n");

      // Still return 200 to prevent Stripe from retrying
      res.status(200).json({
        message: "Webhook received but processing failed",
        success: false,
        error: handlerError.message,
      });
      return;
    }
  } catch (error: any) {
    console.error("❌ [WEBHOOK] Critical webhook error:", error);
    console.error("❌ [WEBHOOK] Error message:", error.message);
    console.error("❌ [WEBHOOK] Error stack:", error.stack);
    console.log("========== STRIPE WEBHOOK END (CRITICAL ERROR) ==========\n");

    res.status(500).json({
      message: error.message || "Failed to process webhook",
      success: false,
    });
    return;
  }
};

async function handlePaymentSuccess(paymentIntent: any) {
  console.log("\n🎉 [PAYMENT SUCCESS] Processing payment_intent.succeeded");
  console.log(`🎉 [PAYMENT SUCCESS] Payment Intent ID: ${paymentIntent.id}`);
  console.log(`🎉 [PAYMENT SUCCESS] Amount: ${paymentIntent.amount / 100} ${paymentIntent.currency.toUpperCase()}`);
  console.log(`🎉 [PAYMENT SUCCESS] Status: ${paymentIntent.status}`);
  console.log(`🎉 [PAYMENT SUCCESS] Invoice ID from metadata: ${paymentIntent.metadata?.invoiceId}`);
  console.log(`🎉 [PAYMENT SUCCESS] Customer ID from metadata: ${paymentIntent.metadata?.customerId}`);
  console.log(`🎉 [PAYMENT SUCCESS] Created: ${new Date(paymentIntent.created * 1000).toISOString()}`);

  try {
    // Find payment by gateway order ID
    console.log(`🔍 [PAYMENT SUCCESS] Looking for payment with order ID: ${paymentIntent.id}`);
    const payment = await paymentRepository.getPaymentByOrderId(
      paymentIntent.id,
    );

    if (!payment) {
      console.error(`❌ [PAYMENT SUCCESS] Payment not found for order ID: ${paymentIntent.id}`);
      console.error(`❌ [PAYMENT SUCCESS] This usually means the payment record was not created in the database`);
      console.error(`❌ [PAYMENT SUCCESS] when the Stripe payment intent was created.`);

      // Try to find by invoice ID as fallback
      if (paymentIntent.metadata?.invoiceId) {
        console.log(`🔄 [PAYMENT SUCCESS] Attempting fallback - finding payment by invoice ID: ${paymentIntent.metadata.invoiceId}`);

        try {
          const invoicePayments = await paymentRepository.getPaymentsByInvoice(paymentIntent.metadata.invoiceId);
          console.log(`📋 [PAYMENT SUCCESS] Found ${invoicePayments.length} payment(s) for this invoice`);

          if (invoicePayments.length > 0) {
            const latestPayment = invoicePayments[0]; // Get the most recent payment
            console.log(`🔄 [PAYMENT SUCCESS] Updating latest payment: ${latestPayment.id} with order ID: ${paymentIntent.id}`);
            console.log(`🔄 [PAYMENT SUCCESS] Current payment status: ${latestPayment.status}`);

            // Update this payment with the correct order ID
            await paymentRepository.updatePaymentStatus(latestPayment.id, "completed", {
              gatewayPaymentId: paymentIntent.id,
              gatewayResponse: paymentIntent,
              completedAt: new Date(paymentIntent.created * 1000),
            });

            console.log(`✅ [PAYMENT SUCCESS] Payment ${latestPayment.id} marked as completed (fallback method)`);

            // Update invoice status
            await invoiceRepository.updateInvoiceStatus(latestPayment.invoiceId, "paid", {
              paymentMethod: paymentIntent.payment_method_types[0] || "card",
              paymentId: paymentIntent.id,
              transactionId: paymentIntent.charges?.data[0]?.id || paymentIntent.id,
              paidAt: new Date(),
            });

            console.log(`✅ [PAYMENT SUCCESS] Invoice ${latestPayment.invoiceId} marked as paid (fallback method)`);
            return;
          }
        } catch (fallbackError: any) {
          console.error(`❌ [PAYMENT SUCCESS] Fallback method failed:`, fallbackError.message);
          console.error(`❌ [PAYMENT SUCCESS] Fallback error stack:`, fallbackError.stack);
        }
      }

      console.error(`❌ [PAYMENT SUCCESS] No payment found. Cannot complete payment.`);
      console.error(`❌ [PAYMENT SUCCESS] Payment intent will remain successful but database won't be updated.`);
      return;
    }

    console.log(`✅ [PAYMENT SUCCESS] Payment found: ${payment.id}`);
    console.log(`✅ [PAYMENT SUCCESS] Current payment status: ${payment.status}`);
    console.log(`✅ [PAYMENT SUCCESS] Payment invoice ID: ${payment.invoiceId}`);

    // Skip if already completed
    if (payment.status === "completed") {
      console.log(`ℹ️ [PAYMENT SUCCESS] Payment already completed: ${payment.id}`);
      return;
    }

    console.log(`🔄 [PAYMENT SUCCESS] Updating payment status to 'completed'...`);

    // Update payment status
    await paymentRepository.updatePaymentStatus(payment.id, "completed", {
      gatewayPaymentId: paymentIntent.id,
      gatewayResponse: paymentIntent,
      completedAt: new Date(
        paymentIntent.created * 1000,
      ) /* Convert Unix timestamp */,
    });

    console.log(`✅ [PAYMENT SUCCESS] Payment ${payment.id} marked as completed`);

    console.log(`🔄 [PAYMENT SUCCESS] Updating invoice ${payment.invoiceId} status to 'paid'...`);

    // Update invoice status
    await invoiceRepository.updateInvoiceStatus(payment.invoiceId, "paid", {
      paymentMethod: paymentIntent.payment_method_types[0] || "card",
      paymentId: paymentIntent.id,
      transactionId: paymentIntent.charges?.data[0]?.id || paymentIntent.id,
      paidAt: new Date(),
    });

    console.log(`✅ [PAYMENT SUCCESS] Invoice ${payment.invoiceId} marked as paid`);
    console.log(`🎉 [PAYMENT SUCCESS] Payment processing complete!`);
  } catch (error: any) {
    console.error("❌ [PAYMENT SUCCESS] Error handling payment success:", error);
    console.error("❌ [PAYMENT SUCCESS] Error message:", error.message);
    console.error("❌ [PAYMENT SUCCESS] Error stack:", error.stack);
    throw error;
  }
}

async function handlePaymentFailure(paymentIntent: any) {
  console.log("\n❌ [PAYMENT FAILED] Processing payment_intent.payment_failed");
  console.log(`❌ [PAYMENT FAILED] Payment Intent ID: ${paymentIntent.id}`);
  console.log(`❌ [PAYMENT FAILED] Error: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`);

  try {
    // Find payment by gateway order ID
    console.log(`🔍 [PAYMENT FAILED] Looking for payment with order ID: ${paymentIntent.id}`);
    const payment = await paymentRepository.getPaymentByOrderId(
      paymentIntent.id,
    );

    if (!payment) {
      console.error(`❌ [PAYMENT FAILED] Payment not found for order ID: ${paymentIntent.id}`);
      return;
    }

    console.log(`✅ [PAYMENT FAILED] Payment found: ${payment.id}`);
    console.log(`🔄 [PAYMENT FAILED] Updating payment status to 'failed'...`);

    // Update payment status to failed
    await paymentRepository.updatePaymentStatus(payment.id, "failed", {
      gatewayPaymentId: paymentIntent.id,
      gatewayResponse: paymentIntent,
      failureReason:
        paymentIntent.last_payment_error?.message || "Payment failed",
      failedAt: new Date(),
    });

    console.log(`✅ [PAYMENT FAILED] Payment ${payment.id} marked as failed`);
  } catch (error: any) {
    console.error("❌ [PAYMENT FAILED] Error handling payment failure:", error);
    console.error("❌ [PAYMENT FAILED] Error message:", error.message);
    throw error;
  }
}

async function handleRefundUpdate(charge: any) {
  console.log("\n💰 [REFUND UPDATE] Processing charge.refund.updated");
  console.log(`💰 [REFUND UPDATE] Charge ID: ${charge.id}`);
  console.log(`💰 [REFUND UPDATE] Payment Intent: ${charge.payment_intent}`);
  console.log(`💰 [REFUND UPDATE] Amount refunded: ${charge.amount_refunded ? charge.amount_refunded / 100 : 0}`);

  try {
    // Find payment by charge ID (transaction ID)
    console.log(`🔍 [REFUND UPDATE] Looking for payment with payment intent: ${charge.payment_intent}`);
    const payments = await paymentRepository.getAllPayments({});
    const payment = payments.payments.find(
      (p: any) => p.gatewayPaymentId === charge.payment_intent,
    );

    if (!payment) {
      console.error(`❌ [REFUND UPDATE] Payment not found for charge: ${charge.id}`);
      return;
    }

    console.log(`✅ [REFUND UPDATE] Payment found: ${payment.id}`);

    // Get or create refund record
    console.log(`🔍 [REFUND UPDATE] Looking for existing refund record: ${charge.id}`);
    let refund = await refundRepository.getRefundByGatewayId(charge.id);

    if (!refund && charge.refunded) {
      console.log(`🔄 [REFUND UPDATE] Creating new refund record...`);

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

      console.log(`✅ [REFUND UPDATE] Refund ${refund.id} created for payment ${payment.id}`);
    } else if (refund) {
      console.log(`🔄 [REFUND UPDATE] Updating existing refund: ${refund.id}`);

      // Update existing refund
      await refundRepository.updateRefundStatus(refund.id, "completed", {
        gatewayResponse: charge,
        completedAt: new Date(),
      });

      console.log(`✅ [REFUND UPDATE] Refund ${refund.id} updated to completed`);
    }
  } catch (error: any) {
    console.error("❌ [REFUND UPDATE] Error handling refund update:", error);
    console.error("❌ [REFUND UPDATE] Error message:", error.message);
    throw error;
  }
}

async function handleRefundProcessed(charge: any) {
  console.log("\n💰 [REFUND PROCESSED] Processing charge.refunded");
  console.log(`💰 [REFUND PROCESSED] Charge ID: ${charge.id}`);
  console.log(`💰 [REFUND PROCESSED] Payment Intent: ${charge.payment_intent}`);

  try {
    // Similar to refund update, but ensures full refund is tracked
    await handleRefundUpdate(charge);
    console.log(`✅ [REFUND PROCESSED] Refund processing complete`);
  } catch (error: any) {
    console.error("❌ [REFUND PROCESSED] Error handling refund processed:", error);
    console.error("❌ [REFUND PROCESSED] Error message:", error.message);
    throw error;
  }
}

async function handlePaymentIntentCreated(paymentIntent: any) {
  console.log("\n🔨 [INTENT CREATED] Processing payment_intent.created");
  console.log(`🔨 [INTENT CREATED] Payment Intent ID: ${paymentIntent.id}`);
  console.log(`🔨 [INTENT CREATED] Amount: ${paymentIntent.amount / 100} ${paymentIntent.currency.toUpperCase()}`);
  console.log(`🔨 [INTENT CREATED] Invoice ID from metadata: ${paymentIntent.metadata?.invoiceId}`);

  try {
    // Log the creation but don't take any action
    // The payment record should already exist from when we created the intent
    console.log(`🔍 [INTENT CREATED] Checking if payment record exists...`);
    const payment = await paymentRepository.getPaymentByOrderId(paymentIntent.id);

    if (!payment) {
      console.warn(`⚠️ [INTENT CREATED] Payment record not found for newly created intent: ${paymentIntent.id}`);
      console.warn(`⚠️ [INTENT CREATED] Invoice ID from metadata: ${paymentIntent.metadata?.invoiceId}`);
      console.warn(`⚠️ [INTENT CREATED] This could indicate a race condition or missing payment creation`);
    } else {
      console.log(`✅ [INTENT CREATED] Payment record found for intent: ${paymentIntent.id}`);
      console.log(`✅ [INTENT CREATED] Payment status: ${payment.status}`);
    }
  } catch (error: any) {
    console.error("❌ [INTENT CREATED] Error handling payment intent created:", error);
    console.error("❌ [INTENT CREATED] Error message:", error.message);
    // Don't throw - this is just informational
  }
}

async function handleChargeSucceeded(charge: any) {
  console.log("\n💳 [CHARGE SUCCEEDED] Processing charge.succeeded");
  console.log(`💳 [CHARGE SUCCEEDED] Charge ID: ${charge.id}`);
  console.log(`💳 [CHARGE SUCCEEDED] Amount: ${charge.amount / 100} ${charge.currency.toUpperCase()}`);
  console.log(`💳 [CHARGE SUCCEEDED] Payment Intent: ${charge.payment_intent}`);

  try {
    // Charge succeeded is usually followed by payment_intent.succeeded
    // We don't need to take action here as payment_intent.succeeded will handle it
    const paymentIntentId = charge.payment_intent;
    console.log(`💳 [CHARGE SUCCEEDED] Associated payment intent: ${paymentIntentId}`);
    console.log(`ℹ️ [CHARGE SUCCEEDED] This event is informational - payment_intent.succeeded will handle the completion`);
  } catch (error: any) {
    console.error("❌ [CHARGE SUCCEEDED] Error handling charge succeeded:", error);
    console.error("❌ [CHARGE SUCCEEDED] Error message:", error.message);
    // Don't throw - this is just informational
  }
}

async function handleChargeUpdated(charge: any) {
  console.log("\n💳 [CHARGE UPDATED] Processing charge.updated");
  console.log(`💳 [CHARGE UPDATED] Charge ID: ${charge.id}`);
  console.log(`💳 [CHARGE UPDATED] Status: ${charge.status}`);
  console.log(`💳 [CHARGE UPDATED] Payment Intent: ${charge.payment_intent}`);

  try {
    // Log charge updates but don't take action
    // The payment_intent.succeeded event will handle the actual payment completion
    console.log(`ℹ️ [CHARGE UPDATED] This event is informational - payment_intent.succeeded will handle the completion`);
  } catch (error: any) {
    console.error("❌ [CHARGE UPDATED] Error handling charge updated:", error);
    console.error("❌ [CHARGE UPDATED] Error message:", error.message);
    // Don't throw - this is just informational
  }
}
