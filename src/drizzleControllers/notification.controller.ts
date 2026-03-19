import { Request, Response } from "express";
import { notificationRepository } from "#db/repositories/notification.repository.js";

// Get all notifications for the authenticated customer
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user?.id;
    if (!customerId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const unreadOnly = req.query.unreadOnly === "true";
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;

    let result;
    if (unreadOnly) {
      result = await notificationRepository.findUnreadByRecipientId(
        customerId,
        "customer",
        { page, limit }
      );
    } else {
      result = await notificationRepository.findByRecipientId(
        customerId,
        "customer",
        { page, limit }
      );
    }

    const unreadCount = await notificationRepository.countUnreadByRecipient(
      customerId,
      "customer"
    );

    res.status(200).json({
      notifications: result.notifications,
      total: result.total,
      unreadCount,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

// Mark a notification as read
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const customerId = (req as any).user?.id;

    if (!customerId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    if (typeof id !== "string") {
      res.status(400).json({ message: "Invalid notification ID" });
      return;
    }

    const notification = await notificationRepository.findById(id);

    if (!notification) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }

    if (notification.recipientId !== customerId) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    const updated = await notificationRepository.markAsRead(id);

    res.status(200).json({
      message: "Notification marked as read",
      notification: updated,
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ message: "Failed to mark notification as read" });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user?.id;

    if (!customerId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const updatedCount = await notificationRepository.markAllAsRead(
      customerId,
      "customer"
    );

    res.status(200).json({
      message: "All notifications marked as read",
      count: updatedCount,
    });
  } catch (error) {
    console.error("Error marking all as read:", error);
    res.status(500).json({ message: "Failed to mark all notifications as read" });
  }
};

// Delete a notification
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const customerId = (req as any).user?.id;

    if (!customerId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    if (typeof id !== "string") {
      res.status(400).json({ message: "Invalid notification ID" });
      return;
    }

    const notification = await notificationRepository.findById(id);

    if (!notification) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }

    if (notification.recipientId !== customerId) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    await notificationRepository.deleteNotification(id);

    res.status(200).json({ message: "Notification deleted" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ message: "Failed to delete notification" });
  }
};

// Get notification preferences (stub for now - can be expanded later)
export const getNotificationPreferences = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user?.id;

    if (!customerId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    // Return default preferences for now
    // In a real implementation, you would store these in the database
    res.status(200).json({
      email: true,
      push: true,
      requestUpdates: true,
      reviewUpdates: true,
      promotional: false,
      systemUpdates: true,
    });
  } catch (error) {
    console.error("Error fetching notification preferences:", error);
    res.status(500).json({ message: "Failed to fetch notification preferences" });
  }
};

// Update notification preferences (stub for now - can be expanded later)
export const updateNotificationPreferences = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user?.id;

    if (!customerId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const preferences = req.body;

    // In a real implementation, you would save these to the database
    // For now, just return success
    res.status(200).json({
      message: "Notification preferences updated",
      preferences,
    });
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    res.status(500).json({ message: "Failed to update notification preferences" });
  }
};
