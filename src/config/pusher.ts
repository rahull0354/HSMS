import Pusher from "pusher";

// Initialize Pusher for real-time notifications
export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || "",
  key: process.env.PUSHER_KEY || "",
  secret: process.env.PUSHER_SECRET || "",
  cluster: process.env.PUSHER_CLUSTER || "ap2",
  useTLS: true,
});

// Pusher channel names
export const PUSH_CHANNELS = {
  CUSTOMER: (customerId: string) => `customer-${customerId}`,
  PROVIDER: (providerId: string) => `provider-${providerId}`,
  ADMIN: (adminId: string) => `admin-${adminId}`,
  GLOBAL: "global-notifications",
};

// Pusher event names
export const PUSH_EVENTS = {
  // Service request events
  REQUEST_CREATED: "request.created",
  REQUEST_ACCEPTED: "request.accepted",
  REQUEST_CANCELLED: "request.cancelled",
  REQUEST_RESCHEDULED: "request.rescheduled",
  REQUEST_STARTED: "request.started",
  REQUEST_COMPLETED: "request.completed",

  // Payment events
  PAYMENT_INITIATED: "payment.initiated",
  PAYMENT_COMPLETED: "payment.completed",
  PAYMENT_FAILED: "payment.failed",

  // Payout events
  PAYOUT_INITIATED: "payout.initiated",
  PAYOUT_PROCESSED: "payout.processed",
  PAYOUT_COMPLETED: "payout.completed",
  PAYOUT_FAILED: "payout.failed",

  // Review events
  NEW_REVIEW: "review.new",
  REVIEW_REPLY: "review.reply",

  // General notification
  NEW_NOTIFICATION: "notification.new",
};

// Helper function to trigger pusher events
export const triggerPusherEvent = (
  channel: string,
  event: string,
  data: any,
) => {
  try {
    console.log(
      `📢 [PUSHER] Triggering event: ${event} on channel: ${channel}`,
    );
    console.log(`📢 [PUSHER] Data:`, JSON.stringify(data, null, 2));

    pusher.trigger(channel, event, {
      ...data,
      timestamp: new Date().toISOString(),
    });

    console.log(`✅ [PUSHER] Event triggered successfully`);
  } catch (error) {
    console.error(`❌ [PUSHER] Error triggering event:`, error);
    // Don't throw - notification failures shouldn't break the main flow
  }
};

// Helper function to trigger user-specific notifications
export const triggerUserNotification = (
  recipientType: "customer" | "provider" | "admin",
  recipientId: string,
  notificationData: any,
) => {
  const channel =
    recipientType === "customer"
      ? PUSH_CHANNELS.CUSTOMER(recipientId)
      : recipientType === "provider"
        ? PUSH_CHANNELS.PROVIDER(recipientId)
        : PUSH_CHANNELS.ADMIN(recipientId);

  triggerPusherEvent(channel, PUSH_EVENTS.NEW_NOTIFICATION, {
    recipientType,
    recipientId,
    ...notificationData,
  });
};
