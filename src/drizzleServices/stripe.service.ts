import Stripe from "stripe";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-11-20.acacia" as any,
  typescript: true,
});

export class StripeService {
  async createPaymentIntent(data: {
    amount: number; // in paise/smallest unit
    currency?: string;
    invoiceId: string;
    customerId: string;
    description?: string;
    metadata?: Record<string, string>;
  }) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: data.amount,
        currency: data.currency || "inr",
        description:
          data.description || `Payment for invoice ${data.invoiceId}`,
        metadata: {
          invoiceId: data.invoiceId,
          customerId: data.customerId,
          ...data.metadata,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      };
    } catch (error: any) {
      console.error("Stripe Payment Intent Creation Error:", error);
      return {
        success: false,
        error: error.message || "Failed to create payment intent",
      };
    }
  }

  async getPaymentIntent(paymentIntentId: string) {
    try {
      const paymentIntent =
        await stripe.paymentIntents.retrieve(paymentIntentId);

      return {
        success: true,
        data: paymentIntent,
      };
    } catch (error: any) {
      console.error("Stripe Payment Intent Retrieve Error:", error);
      return {
        success: false,
        error: error.message || "Failed to retrieve payment intent",
      };
    }
  }

  async confirmPaymentIntent(paymentIntentId: string, paymentMethodId: string) {
    try {
      const paymentIntent = await stripe.paymentIntents.confirm(
        paymentIntentId,
        {
          payment_method: paymentMethodId,
        },
      );

      return {
        success: true,
        data: paymentIntent,
      };
    } catch (error: any) {
      console.error("Stripe Payment Intent Confirm Error:", error);
      return {
        success: false,
        error: error.message || "Failed to confirm payment intent",
      };
    }
  }

  async cancelPaymentIntent(paymentIntentId: string) {
    try {
      const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);

      return {
        success: true,
        data: paymentIntent,
      };
    } catch (error: any) {
      console.error("Stripe Payment Intent Cancel Error:", error);
      return {
        success: false,
        error: error.message || "Failed to cancel payment intent",
      };
    }
  }

  async createRefund(data: {
    paymentIntentId: string;
    amount?: number; // Optional - partial refund if specified, full refund if not
    reason?: "duplicate" | "fraudulent" | "requested_by_customer" | null;
    metadata?: Record<string, string>;
  }) {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: data.paymentIntentId,
        amount: data.amount,
        reason: data.reason || "requested_by_customer",
        metadata: data.metadata,
      });

      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status,
        data: refund,
      };
    } catch (error: any) {
      console.error("Stripe Refund Error:", error);
      return {
        success: false,
        error: error.message || "Failed to create refund",
      };
    }
  }

  async getRefund(refundId: string) {
    try {
      const refund = await stripe.refunds.retrieve(refundId);

      return {
        success: true,
        data: refund,
      };
    } catch (error: any) {
      console.error("Stripe Refund Retrieve Error:", error);
      return {
        success: false,
        error: error.message || "Failed to retrieve refund",
      };
    }
  }

  async createCustomer(data: {
    name?: string;
    email?: string;
    phone?: string;
    metadata?: Record<string, string>;
  }) {
    try {
      const customer = await stripe.customers.create({
        name: data.name,
        email: data.email,
        phone: data.phone,
        metadata: data.metadata,
      });

      return {
        success: true,
        customerId: customer.id,
        data: customer,
      };
    } catch (error: any) {
      console.error("Stripe Customer Creation Error:", error);
      return {
        success: false,
        error: error.message || "Failed to create customer",
      };
    }
  }

  async createSetupIntent(customerId: string) {
    try {
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ["card"],
      });

      return {
        success: true,
        clientSecret: setupIntent.client_secret,
        setupIntentId: setupIntent.id,
        data: setupIntent,
      };
    } catch (error: any) {
      console.error("Stripe Setup Intent Error:", error);
      return {
        success: false,
        error: error.message || "Failed to create setup intent",
      };
    }
  }

  async listPaymentMethods(customerId: string, type: string = "card") {
    try {
      const paymentMethods = await stripe.customers.listPaymentMethods(
        customerId,
        { type: type as any },
      );

      return {
        success: true,
        data: paymentMethods.data,
      };
    } catch (error: any) {
      console.error("Stripe List Payment Methods Error:", error);
      return {
        success: false,
        error: error.message || "Failed to list payment methods",
      };
    }
  }

  async detachPaymentMethod(paymentMethodId: string) {
    try {
      const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);

      return {
        success: true,
        data: paymentMethod,
      };
    } catch (error: any) {
      console.error("Stripe Detach Payment Method Error:", error);
      return {
        success: false,
        error: error.message || "Failed to detach payment method",
      };
    }
  }

  async createPaymentMethod(paymentMethodId: string) {
    try {
      const paymentMethod =
        await stripe.paymentMethods.retrieve(paymentMethodId);

      return {
        success: true,
        data: paymentMethod,
      };
    } catch (error: any) {
      console.error("Stripe Payment Method Error:", error);
      return {
        success: false,
        error: error.message || "Failed to retrieve payment method",
      };
    }
  }

  constructWebhookEvent(
    payload: Buffer,
    signature: string,
    webhookSecret: string,
  ) {
    try {
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );

      return {
        success: true,
        event,
      };
    } catch (error: any) {
      console.error("Stripe Webhook Construction Error:", error);
      return {
        success: false,
        error: error.message || "Invalid webhook signature",
      };
    }
  }

  verifyWebhookSignature(payload: Buffer, signature: string): boolean {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error("Stripe webhook secret not configured");
        return false;
      }

      stripe.webhooks.constructEvent(payload, signature, webhookSecret);

      return true;
    } catch (error) {
      console.error("Stripe webhook signature verification failed:", error);
      return false;
    }
  }

  async handleWebhookEvent(event: Stripe.Event) {
    try {
      switch (event.type) {
        case "payment_intent.succeeded":
          return {
            success: true,
            eventType: "payment_intent.succeeded",
            data: event.data.object,
          };

        case "payment_intent.payment_failed":
          return {
            success: true,
            eventType: "payment_intent.payment_failed",
            data: event.data.object,
          };

        case "payment_intent.created":
          return {
            success: true,
            eventType: "payment_intent.created",
            data: event.data.object,
          };

        case "charge.refund.updated":
        case "charge.refunded":
          return {
            success: true,
            eventType: event.type,
            data: event.data.object,
          };

        default:
          return {
            success: true,
            eventType: event.type,
            data: event.data.object,
          };
      }
    } catch (error: any) {
      console.error("Stripe Webhook Event Handling Error:", error);
      return {
        success: false,
        error: error.message || "Failed to handle webhook event",
      };
    }
  }

  async getBalance() {
    try {
      const balance = await stripe.balance.retrieve();

      return {
        success: true,
        data: balance,
      };
    } catch (error: any) {
      console.error("Stripe Balance Retrieve Error:", error);
      return {
        success: false,
        error: error.message || "Failed to retrieve balance",
      };
    }
  }

  async listCharges(options?: {
    limit?: number;
    starting_after?: string;
    created?: { gte?: number; lte?: number };
  }) {
    try {
      const charges = await stripe.charges.list({
        limit: options?.limit || 10,
        starting_after: options?.starting_after,
        created: options?.created,
      });

      return {
        success: true,
        data: charges.data,
        hasMore: charges.has_more,
      };
    } catch (error: any) {
      console.error("Stripe List Charges Error:", error);
      return {
        success: false,
        error: error.message || "Failed to list charges",
      };
    }
  }
}

// Export singleton instance
export const stripeService = new StripeService();
