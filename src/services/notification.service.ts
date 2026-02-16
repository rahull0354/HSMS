import Notification from "#models/notification.model.js"

// notify customer when service is cancelled
export const notifyCustomerRequestCancelled = async (
    customerId: string,
    requestId: string,
    requestTitle: string,
    cancellationReason: string
) => {
    try {
        const notification = new Notification({
            recipient: customerId,
            recipientType: 'customer',
            type: "request_cancelled",
            title: "Service Request Cancelled",
            message: `Your service request ${requestTitle} has been cancelled. Reason: ${cancellationReason}`,
            requestId: requestId,
            isRead: false
        })

        await notification.save()
        console.log(`Notification Sent to customer ${customerId}`);
        return notification
    } catch (error) {
        console.error("error creating customer notification: ", error);
        throw error
    }
}

// notify provider when service is cancelled by customer
export const notifyProviderRequestCancelled = async (
    providerId: string,
    requestId: string,
    requestTitle: string,
    cancellationReason: string,
    customerName: string
) => {
    try {
        const notification = new Notification({
            recipient: providerId,
            recipientType: "serviceProvider",
            type: "request_cancelled",
            title: "Service Request Cancelled",
            message: `Customer ${customerName} has cancelled the assigned request "${requestTitle}". Reason: ${cancellationReason}`,
            requestId: requestId,
            isRead: false
        })

        await notification.save()
        console.log(`Notification sent to provider ${providerId}`);
        return notification
    } catch (error) {
        console.error("Error sending notification to provider: ", error);
        throw error
    }
}

// handle all notifications for request cancellation
export const handleCancellationNotifications = async (
    customerId: string,
    customerName: string,
    providerId: string | null,
    providerName: string | null,
    requestId: string,
    requestTitle: string,
    cancellationReason: string
) => {
    try {
        const notifications = []

        // 1. Always notify customer
        const customerNotification = await notifyCustomerRequestCancelled(
            customerId,
            requestId,
            requestTitle,
            cancellationReason
        )
        notifications.push(customerNotification)

        // 2. Notify provider if assigned
        if(providerId && providerName) {
            const providerNotification = await notifyProviderRequestCancelled(
                providerId,
                requestId,
                requestTitle,
                cancellationReason,
                customerName
            )
            notifications.push(providerNotification)
        }

        return {
            success: true,
            notificationsCreated: notifications.length,
            notifications
        }
    } catch (error) {
        console.error("Error Creating Cancellation Notification: ", error);
        throw error
    }
}

// notify customer when service is rescheduled
export const notifyCustomerRequestRescheduled = async (
    customerId: string,
    requestId: string,
    requestTitle: string,
) => {
    try {
        const notification = new Notification({
            recipient: customerId,
            recipientType: 'customer',
            type: "request_rescheduled",
            title: "Service Request Rescheduled",
            message: `Your service request ${requestTitle} has been re-scheduled`,
            requestId: requestId,
            isRead: false
        })

        await notification.save()
        console.log(`Notification Sent to customer ${customerId}`);
        return notification
    } catch (error) {
        console.error("error creating customer notification: ", error);
        throw error
    }
}

// notify provider when service is re-scheduled by customer
export const notifyProviderRequestRescheduled = async (
    providerId: string,
    requestId: string,
    requestTitle: string,
    customerName: string
) => {
    try {
        const notification = new Notification({
            recipient: providerId,
            recipientType: "serviceProvider",
            type: "request_rescheduled",
            title: "Service Request Rescheduled",
            message: `Customer ${customerName} has rescheduled the assigned request "${requestTitle}"`,
            requestId: requestId,
            isRead: false
        })

        await notification.save()
        console.log(`Notification sent to provider ${providerId}`);
        return notification
    } catch (error) {
        console.error("Error sending notification to provider: ", error);
        throw error
    }
}

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
        const notifications = []

        // 1. Always notify customer
        const customerNotification = await notifyCustomerRequestRescheduled(
            customerId,
            requestId,
            requestTitle,
        )
        notifications.push(customerNotification)

        // 2. Notify provider if assigned
        if(providerId && providerName) {
            const providerNotification = await notifyProviderRequestRescheduled(
                providerId,
                requestId,
                requestTitle,
                customerName
            )
            notifications.push(providerNotification)
        }

        return {
            success: true,
            notificationsCreated: notifications.length,
            notifications
        }
    } catch (error) {
        console.error("Error Creating Re-Scheduling Notification: ", error);
        throw error
    }
}

// notify customer that service request is accepted

export const notifyCustomerRequestAccepted = async (
    customerId: string,
    providerName: string,
    requestId: string,
    requestTitle: string
) => {
    try {
        const notification = new Notification({
            recipient: customerId,
            recipientType: 'customer',
            type: 'request_assigned',
            title: "Service Request Accepted",
            message: `Great news! Your service request "${requestTitle}" has been assigned to ${providerName}. They will contact you shortly.`,
            requestId: requestId,
            isRead: false
        })

        await notification.save()
        console.log(`Notification sent to customer ${customerId}`)
        return notification
    } catch (error) {
        console.error("Error Creating Request Accepted Notification: ", error);
        throw error
    }
}

// handler for sending request accepted notification
export const handleRequestAcceptedNotifications = async (
    customerId: string,
    customerName: string,
    providerId: string,
    providerName: string,
    requestId: string,
    requestTitle: string
) => {
    try {
        const notifications = []

        const customerNotification = await notifyCustomerRequestAccepted(
            customerId,
            providerName,
            requestId,
            requestTitle
        )
        notifications.push(customerNotification)

        return {
            success: true,
            notificationsCreated: notifications.length,
            notifications
        }
    } catch (error) {
        console.error("Error Creating Accept Request Notification: ", error);
        throw error
    }
}

// sending notification if a provider has responded to a customer's review

export const notifyCustomerAboutReviewReply = async (
    customerId: string,
    customerName: string,
    providerName: string,
    reviewId: string,
    responseComment: string
) => {
    try {
        const notification = new Notification({
            recipient: customerId,
            recipientType: "customer",
            type: "new_review",
            title: "Provider Responded to Your Review",
            message: `${providerName} has responded to your review: "${responseComment.substring(0, 100)}${responseComment.length > 100 ? "..." : ""}"`,
            reviewId: reviewId,
            isRead: false
        })

        await notification.save()
        console.log(`Notification sent to provider ${customerId}`);
        return notification
    } catch (error) {
        console.error("Error sending notification to customer: ", error);
        throw error
    }
}

export const handleReviewResponseNotification = async (
    customerId: string,
    customerName: string,
    providerId: string,
    providerName: string,
    reviewId: string,
    responseComment: string
) => {
    try {
        const notification = []

        const customerNotification = await notifyCustomerAboutReviewReply(
            customerId,
            customerName,
            providerName,
            reviewId,
            responseComment
        )
        notification.push(customerNotification)

        return {
            success: true,
            notificationsCreated: notification.length,
            notification
        }
    } catch (error) {
        console.error("error creating review response notification: ", error);
        throw error
    }
}
