import { notificationRepository } from "#db/repositories/notification.repository.js";
import { triggerUserNotification, PUSH_EVENTS } from "#config/pusher.js";

// notify customer when service is cancelled
export const notifyCustomerRequestCancelled = async (
  customerId: string,
  requestId: string,
  requestTitle: string,
  cancellationReason: string,
) => {
  try {
    const notification = await notificationRepository.create({
      recipientId: customerId,
      recipientType: "customer",
      type: "request_cancelled",
      title: "Service Request Cancelled",
      message: `Your service request ${requestTitle} has been cancelled. Reason: ${cancellationReason}`,
      requestId: requestId,
      isRead: false,
    });

    console.log(
      `📢 [NOTIFICATION] Database notification sent to customer ${customerId}`,
    );

    // Trigger real-time Pusher notification
    triggerUserNotification("customer", customerId, {
      id: notification.id,
      type: "request_cancelled",
      title: "Service Request Cancelled",
      message: `Your service request ${requestTitle} has been cancelled. Reason: ${cancellationReason}`,
      requestId: requestId,
      data: { cancellationReason },
    });

    return notification;
  } catch (error) {
    console.error(
      "❌ [NOTIFICATION] Error creating customer notification:",
      error,
    );
    throw error;
  }
};

// notify provider when service is cancelled by customer
export const notifyProviderRequestCancelled = async (
  providerId: string,
  requestId: string,
  requestTitle: string,
  cancellationReason: string,
  customerName: string,
) => {
  try {
    const notification = await notificationRepository.create({
      recipientId: providerId,
      recipientType: "serviceProvider",
      type: "request_cancelled",
      title: "Service Request Cancelled",
      message: `Customer ${customerName} has cancelled the assigned request "${requestTitle}". Reason: ${cancellationReason}`,
      requestId: requestId,
      isRead: false,
    });

    console.log(
      `📢 [NOTIFICATION] Database notification sent to provider ${providerId}`,
    );

    // Trigger real-time Pusher notification
    triggerUserNotification("provider", providerId, {
      id: notification.id,
      type: "request_cancelled",
      title: "Service Request Cancelled",
      message: `Customer ${customerName} has cancelled the assigned request "${requestTitle}".`,
      requestId: requestId,
      data: { cancellationReason, customerName },
    });

    return notification;
  } catch (error) {
    console.error(
      "❌ [NOTIFICATION] Error sending notification to provider:",
      error,
    );
    throw error;
  }
};

// handle all notifications for request cancellation
export const handleCancellationNotifications = async (
  customerId: string,
  customerName: string,
  providerId: string | null,
  providerName: string | null,
  requestId: string,
  requestTitle: string,
  cancellationReason: string,
) => {
  try {
    const notifications = [];

    // 1. Always notify customer
    const customerNotification = await notifyCustomerRequestCancelled(
      customerId,
      requestId,
      requestTitle,
      cancellationReason,
    );
    notifications.push(customerNotification);

    // 2. Notify provider if assigned
    if (providerId && providerName) {
      const providerNotification = await notifyProviderRequestCancelled(
        providerId,
        requestId,
        requestTitle,
        cancellationReason,
        customerName,
      );
      notifications.push(providerNotification);
    }

    return {
      success: true,
      notificationsCreated: notifications.length,
      notifications,
    };
  } catch (error) {
    console.error("Error Creating Cancellation Notification: ", error);
    throw error;
  }
};

// notify customer when service is rescheduled
export const notifyCustomerRequestRescheduled = async (
  customerId: string,
  requestId: string,
  requestTitle: string,
) => {
  try {
    const notification = await notificationRepository.create({
      recipientId: customerId,
      recipientType: "customer",
      type: "request_rescheduled",
      title: "Service Request Rescheduled",
      message: `Your service request ${requestTitle} has been re-scheduled`,
      requestId: requestId,
      isRead: false,
    });

    console.log(`📢 [NOTIFICATION] Database notification sent to customer ${customerId}`);

    // Trigger real-time Pusher notification
    triggerUserNotification('customer', customerId, {
      id: notification.id,
      type: 'request_rescheduled',
      title: 'Service Request Rescheduled',
      message: `Your service request ${requestTitle} has been re-scheduled`,
      requestId: requestId,
    });

    return notification;
  } catch (error) {
    console.error("❌ [NOTIFICATION] Error creating customer notification:", error);
    throw error;
  }
};

// notify provider when service is re-scheduled by customer
export const notifyProviderRequestRescheduled = async (
  providerId: string,
  requestId: string,
  requestTitle: string,
  customerName: string,
) => {
  try {
    const notification = await notificationRepository.create({
      recipientId: providerId,
      recipientType: "serviceProvider",
      type: "request_rescheduled",
      title: "Service Request Rescheduled",
      message: `Customer ${customerName} has rescheduled the assigned request "${requestTitle}"`,
      requestId: requestId,
      isRead: false,
    });

    console.log(`📢 [NOTIFICATION] Database notification sent to provider ${providerId}`);

    // Trigger real-time Pusher notification
    triggerUserNotification('provider', providerId, {
      id: notification.id,
      type: 'request_rescheduled',
      title: 'Service Request Rescheduled',
      message: `Customer ${customerName} has rescheduled the assigned request "${requestTitle}"`,
      requestId: requestId,
      data: { customerName }
    });

    return notification;
  } catch (error) {
    console.error("❌ [NOTIFICATION] Error sending notification to provider:", error);
    throw error;
  }
};

// handle all notifications for request cancellation
export const handleReschedulingNotifications = async (
  customerId: string,
  customerName: string,
  providerId: string | null,
  providerName: string | null,
  requestId: string,
  requestTitle: string,
) => {
  try {
    const notifications = [];

    // 1. Always notify customer
    const customerNotification = await notifyCustomerRequestRescheduled(
      customerId,
      requestId,
      requestTitle,
    );
    notifications.push(customerNotification);

    // 2. Notify provider if assigned
    if (providerId && providerName) {
      const providerNotification = await notifyProviderRequestRescheduled(
        providerId,
        requestId,
        requestTitle,
        customerName,
      );
      notifications.push(providerNotification);
    }

    return {
      success: true,
      notificationsCreated: notifications.length,
      notifications,
    };
  } catch (error) {
    console.error("Error Creating Re-Scheduling Notification: ", error);
    throw error;
  }
};

// notify customer that service request is accepted

export const notifyCustomerRequestAccepted = async (
  customerId: string,
  providerName: string,
  requestId: string,
  requestTitle: string,
) => {
  try {
    const notification = await notificationRepository.create({
      recipientId: customerId,
      recipientType: "customer",
      type: "request_assigned",
      title: "Service Request Accepted",
      message: `Great news! Your service request "${requestTitle}" has been assigned to ${providerName}. They will contact you shortly.`,
      requestId: requestId,
      isRead: false,
    });

    console.log(`📢 [NOTIFICATION] Database notification sent to customer ${customerId}`);

    // Trigger real-time Pusher notification
    triggerUserNotification('customer', customerId, {
      id: notification.id,
      type: 'request_assigned',
      title: 'Service Request Accepted',
      message: `Great news! Your service request "${requestTitle}" has been assigned to ${providerName}.`,
      requestId: requestId,
      data: { providerName }
    });

    return notification;
  } catch (error) {
    console.error("❌ [NOTIFICATION] Error Creating Request Accepted Notification:", error);
    throw error;
  }
};

// handler for sending request accepted notification
export const handleRequestAcceptedNotifications = async (
  customerId: string,
  customerName: string,
  providerId: string,
  providerName: string,
  requestId: string,
  requestTitle: string,
) => {
  try {
    const notifications = [];

    const customerNotification = await notifyCustomerRequestAccepted(
      customerId,
      providerName,
      requestId,
      requestTitle,
    );
    notifications.push(customerNotification);

    return {
      success: true,
      notificationsCreated: notifications.length,
      notifications,
    };
  } catch (error) {
    console.error("Error Creating Accept Request Notification: ", error);
    throw error;
  }
};

// sending notification if a provider has responded to a customer's review

export const notifyCustomerAboutReviewReply = async (
  customerId: string,
  customerName: string,
  providerName: string,
  reviewId: string,
  responseComment: string,
) => {
  try {
    const notification = await notificationRepository.create({
      recipientId: customerId,
      recipientType: "customer",
      type: "new_review",
      title: "Provider Responded to Your Review",
      message: `${providerName} has responded to your review: "${responseComment.substring(0, 100)}${responseComment.length > 100 ? "..." : ""}"`,
      reviewId: reviewId,
      isRead: false,
    });

    console.log(`📢 [NOTIFICATION] Database notification sent to customer ${customerId}`);

    // Trigger real-time Pusher notification
    triggerUserNotification('customer', customerId, {
      id: notification.id,
      type: 'review_reply',
      title: 'Provider Responded to Your Review',
      message: `${providerName} has responded to your review`,
      reviewId: reviewId,
      data: { providerName, responseComment }
    });

    return notification;
  } catch (error) {
    console.error("❌ [NOTIFICATION] Error sending notification to customer:", error);
    throw error;
  }
};

export const handleReviewResponseNotification = async (
  customerId: string,
  customerName: string,
  providerId: string,
  providerName: string,
  reviewId: string,
  responseComment: string,
) => {
  try {
    const notification = [];

    const customerNotification = await notifyCustomerAboutReviewReply(
      customerId,
      customerName,
      providerName,
      reviewId,
      responseComment,
    );
    notification.push(customerNotification);

    return {
      success: true,
      notificationsCreated: notification.length,
      notification,
    };
  } catch (error) {
    console.error("error creating review response notification: ", error);
    throw error;
  }
};

// ============================================================
// PAYOUT NOTIFICATIONS
// ============================================================

/**
 * Notify provider when payout is initiated
 */
export const notifyProviderPayoutInitiated = async (
  providerId: string,
  payoutId: string,
  amount: string,
  invoiceCount: number,
) => {
  try {
    const notification = await notificationRepository.create({
      recipientId: providerId,
      recipientType: "serviceProvider",
      type: "payout_initiated",
      title: "Payout Initiated",
      message: `Your payout of ₹${amount} for ${invoiceCount} invoice(s) has been initiated. It will be processed soon.`,
      payoutId: payoutId,
      isRead: false,
    });

    console.log(
      `✉️ [NOTIFICATION] Payout initiated notification sent to provider ${providerId}`,
    );

    // Trigger real-time Pusher notification
    triggerUserNotification('provider', providerId, {
      id: notification.id,
      type: 'payout_initiated',
      title: 'Payout Initiated',
      message: `Your payout of ₹${amount} for ${invoiceCount} invoice(s) has been initiated.`,
      payoutId: payoutId,
      data: { amount, invoiceCount }
    });

    return notification;
  } catch (error) {
    console.error("❌ [NOTIFICATION] Error creating payout initiated notification:", error);
    throw error;
  }
};

/**
 * Notify provider when payout is processed
 */
export const notifyProviderPayoutProcessed = async (
  providerId: string,
  payoutId: string,
  amount: string,
) => {
  try {
    const notification = await notificationRepository.create({
      recipientId: providerId,
      recipientType: "serviceProvider",
      type: "payout_processed",
      title: "Payout Being Processed",
      message: `Your payout of ₹${amount} is being processed. Amount will be credited to your bank account shortly.`,
      payoutId: payoutId,
      isRead: false,
    });

    console.log(
      `✉️ [NOTIFICATION] Payout processed notification sent to provider ${providerId}`,
    );

    // Trigger real-time Pusher notification
    triggerUserNotification('provider', providerId, {
      id: notification.id,
      type: 'payout_processed',
      title: 'Payout Being Processed',
      message: `Your payout of ₹${amount} is being processed.`,
      payoutId: payoutId,
      data: { amount }
    });

    return notification;
  } catch (error) {
    console.error("❌ [NOTIFICATION] Error creating payout processed notification:", error);
    throw error;
  }
};

/**
 * Notify provider when payout is completed
 */
export const notifyProviderPayoutCompleted = async (
  providerId: string,
  payoutId: string,
  amount: string,
  utr: string,
  bankName?: string,
) => {
  try {
    const notification = await notificationRepository.create({
      recipientId: providerId,
      recipientType: "serviceProvider",
      type: "payout_completed",
      title: "Payout Completed",
      message: `Your payout of ₹${amount} has been completed successfully!${bankName ? ` Amount credited to ${bankName}.` : ""} UTR: ${utr}`,
      payoutId: payoutId,
      isRead: false,
    });

    console.log(
      `✅ [NOTIFICATION] Payout completed notification sent to provider ${providerId}`,
    );
    console.log(`   Amount: ₹${amount}, UTR: ${utr}`);

    // Trigger real-time Pusher notification
    triggerUserNotification('provider', providerId, {
      id: notification.id,
      type: 'payout_completed',
      title: 'Payout Completed',
      message: `Your payout of ₹${amount} has been completed! UTR: ${utr}`,
      payoutId: payoutId,
      data: { amount, utr, bankName }
    });

    return notification;
  } catch (error) {
    console.error("❌ [NOTIFICATION] Error creating payout completed notification:", error);
    throw error;
  }
};

/**
 * Notify provider when payout fails
 */
export const notifyProviderPayoutFailed = async (
  providerId: string,
  payoutId: string,
  amount: string,
  failureReason: string,
) => {
  try {
    const notification = await notificationRepository.create({
      recipientId: providerId,
      recipientType: "serviceProvider",
      type: "payout_failed",
      title: "Payout Failed",
      message: `Your payout of ₹${amount} could not be processed. Reason: ${failureReason}. Please contact support.`,
      payoutId: payoutId,
      isRead: false,
    });

    console.log(
      `❌ [NOTIFICATION] Payout failed notification sent to provider ${providerId}`,
    );
    console.log(`   Amount: ₹${amount}, Reason: ${failureReason}`);

    // Trigger real-time Pusher notification
    triggerUserNotification('provider', providerId, {
      id: notification.id,
      type: 'payout_failed',
      title: 'Payout Failed',
      message: `Your payout of ₹${amount} could not be processed. Reason: ${failureReason}`,
      payoutId: payoutId,
      data: { amount, failureReason }
    });

    return notification;
  } catch (error) {
    console.error("❌ [NOTIFICATION] Error creating payout failed notification:", error);
    throw error;
  }
};

/**
 * Notify admin when bank account is added
 */
export const notifyAdminBankAccountAdded = async (
  providerId: string,
  providerName: string,
  bankName: string,
  accountNumberLast4: string,
  ifsc: string,
) => {
  try {
    const notification = await notificationRepository.create({
      recipientId: "system",
      recipientType: "admin",
      type: "bank_account_added",
      title: "New Bank Account Added",
      message: `Provider ${providerName} has added a new bank account: ${bankName} - XXXX-XXXX-XXXX-${accountNumberLast4} (IFSC: ${ifsc}). Please verify.`,
      metadata: {
        providerId,
        providerName,
        bankName,
        accountNumberLast4,
        ifsc,
      },
      isRead: false,
    });

    console.log(
      `🏦 [NOTIFICATION] Bank account added notification sent to admins`,
    );
    console.log(`   Provider: ${providerName}, Bank: ${bankName}`);

    // Trigger real-time Pusher notification to all admins
    triggerUserNotification('admin', 'system', {
      id: notification.id,
      type: 'bank_account_added',
      title: 'New Bank Account Added',
      message: `Provider ${providerName} has added a new bank account: ${bankName}`,
      data: { providerId, providerName, bankName, accountNumberLast4 }
    });

    return notification;
  } catch (error) {
    console.error("❌ [NOTIFICATION] Error creating bank account added notification:", error);
    throw error;
  }
};

export const notifyProviderBankAccountVerified = async (
  providerId: string,
  bankName: string,
  accountNumberLast4: string,
  verificationStatus: "verified" | "failed",
  reference?: string,
) => {
  try {
    const notification = await notificationRepository.create({
      recipientId: providerId,
      recipientType: "serviceProvider",
      type:
        verificationStatus === "verified"
          ? "bank_account_verified"
          : "bank_account_verification_failed",
      title:
        verificationStatus === "verified"
          ? "Bank Account Verified"
          : "Bank Account Verification Failed",
      message:
        verificationStatus === "verified"
          ? `Your bank account ${bankName} (XXXX-XXXX-XXXX-${accountNumberLast4}) has been verified successfully. You can now receive payouts.`
          : `Your bank account ${bankName} (XXXX-XXXX-XXXX-${accountNumberLast4}) verification failed. ${reference ? `Reference: ${reference}` : ""} Please update details and try again.`,
      metadata: {
        bankName,
        accountNumberLast4,
        verificationStatus,
        reference,
      },
      isRead: false,
    });

    console.log(
      `✅ [NOTIFICATION] Bank account ${verificationStatus} notification sent to provider ${providerId}`,
    );

    // Trigger real-time Pusher notification
    triggerUserNotification('provider', providerId, {
      id: notification.id,
      type: verificationStatus === "verified" ? "bank_account_verified" : "bank_account_verification_failed",
      title: verificationStatus === "verified" ? "Bank Account Verified" : "Bank Account Verification Failed",
      message: verificationStatus === "verified"
        ? `Your bank account ${bankName} has been verified successfully.`
        : `Your bank account ${bankName} verification failed.`,
      data: { bankName, accountNumberLast4, verificationStatus, reference }
    });

    return notification;
  } catch (error) {
    console.error(
      "Error creating bank account verification notification:",
      error,
    );
    throw error;
  }
};
