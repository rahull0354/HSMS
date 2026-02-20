import db from "#db/index.js";
import { NewNotification, notifications } from "#db/schema.js";
import { and, desc, eq, sql } from "drizzle-orm";


export class NotificationRepository {
  async create(data: NewNotification) {
    const result = await db
      .insert(notifications)
      .values({
        recipientId: data.recipientId,
        recipientType: data.recipientType,
        type: data.type,
        title: data.title,
        message: data.message,
        requestId: data.requestId || null,
        isRead: data.isRead ?? false,
      })
      .returning();

    return result[0] || null;
  }

  async findById(id: string) {
    const result = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findByRecipientId(
    recipientId: string,
    recipientType: "customer" | "serviceProvider",
    pagination?: {
      page?: number;
      limit?: number;
    },
  ) {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const offset = (page - 1) * limit;

    const notificationList = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          eq(notifications.recipientType, recipientType),
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          eq(notifications.recipientType, recipientType),
        ),
      );

    return {
      notifications: notificationList,
      total: Number(totalResult[0]?.count || 0),
      page,
      limit,
      totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / limit),
    };
  }

  async markAsRead(id: string) {
    const result = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(notifications.id, id))
      .returning();

    return result[0] || null;
  }

  async deleteNotification(id: string) {
    const result = await db
      .delete(notifications)
      .where(eq(notifications.id, id))
      .returning();

    return result[0] || null;
  }

  async findUnreadByRecipientId(
    recipientId: string,
    recipientType: "customer" | "serviceProvider",
    pagination?: {
      page?: number;
      limit?: number;
    },
  ) {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const offset = (page - 1) * limit;

    const unreadNotifications = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          eq(notifications.recipientType, recipientType),
          eq(notifications.isRead, false),
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          eq(notifications.recipientType, recipientType),
          eq(notifications.isRead, false),
        ),
      );

    return {
      notifications: unreadNotifications,
      total: Number(totalResult[0]?.count || 0),
      page,
      limit,
      totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / limit),
    };
  }

  async findByType(
    type:
      | "request_created"
      | "request_assigned"
      | "request_started"
      | "request_completed"
      | "request_cancelled"
      | "request_rescheduled"
      | "new_review"
      | "payment_reminder",
    pagination?: {
      page?: number;
      limit?: number;
    },
  ) {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const offset = (page - 1) * limit;

    const notificationList = await db
      .select()
      .from(notifications)
      .where(eq(notifications.type, type))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(eq(notifications.type, type));

    return {
      notifications: notificationList,
      total: Number(totalResult[0]?.count || 0),
      page,
      limit,
      totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / limit),
    };
  }

  async markAllAsRead(
    recipientId: string,
    recipientType: 'customer' | 'serviceProvider'
  ) {
    const now = new Date()
    const result = await db.update(notifications).set({
        isRead: true,
        readAt: now,
        updatedAt: now,
    }).where(
        and(
            eq(notifications.recipientId, recipientId),
            eq(notifications.recipientType, recipientType),
            eq(notifications.isRead, false)
        )
    ).returning()

    return result.length
  }

  async getNotificationHistory(
    recipientId: string,
    recipientType: 'customer' | 'serviceProvider',
    days: number = 30,
  ) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    return await db.select().from(notifications).where(
        and(
            eq(notifications.recipientId, recipientId),
            eq(notifications.recipientType, recipientType),
            sql`${notifications.createdAt} >= ${startDate}`
        )
    ).orderBy(desc(notifications.createdAt))
  }

  async updateNotification(
    id: string,
    data: {
      title?: string;
      message?: string;
      isRead?: boolean;
      readAt?: Date;
    }
  ) {
    const result = await db
      .update(notifications)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(notifications.id, id))
      .returning();

    return result[0] || null;
  }

  async countUnreadByRecipient(
    recipientId: string,
    recipientType: "customer" | "serviceProvider"
  ) {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          eq(notifications.recipientType, recipientType),
          eq(notifications.isRead, false)
        )
      );

    return Number(result[0]?.count || 0);
  }

  async countByRecipient(
    recipientId: string,
    recipientType: "customer" | "serviceProvider"
  ) {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          eq(notifications.recipientType, recipientType)
        )
      );

    return Number(result[0]?.count || 0);
  }

  async deleteByRecipient(
    recipientId: string,
    recipientType: "customer" | "serviceProvider"
  ) {
    const result = await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          eq(notifications.recipientType, recipientType)
        )
      )
      .returning();

    return result.length;
  }

  async deleteByRequestId(requestId: string) {
    const result = await db
      .delete(notifications)
      .where(eq(notifications.requestId, requestId))
      .returning();

    return result.length;
  }

  async getNotificationStats() {
    const totalNotifications = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications);

    const unreadNotifications = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(eq(notifications.isRead, false));

    const readNotifications = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(eq(notifications.isRead, true));

    const notificationsByType = await db
      .select({
        type: notifications.type,
        count: sql<number>`count(*)`,
      })
      .from(notifications)
      .groupBy(notifications.type);

    return {
      totalNotifications: Number(totalNotifications[0]?.count || 0),
      unreadNotifications: Number(unreadNotifications[0]?.count || 0),
      readNotifications: Number(readNotifications[0]?.count || 0),
      byType: notificationsByType,
    };
  }

  async getNotificationStatsByRecipient(
    recipientId: string,
    recipientType: "customer" | "serviceProvider"
  ) {
    const result = await db
      .select({
        type: notifications.type,
        count: sql<number>`count(*)`,
        unreadCount: sql<number>`sum(case when ${notifications.isRead} = false then 1 else 0 end)`,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          eq(notifications.recipientType, recipientType)
        )
      )
      .groupBy(notifications.type);

    return result;
  }

  async getRecentNotifications(
    recipientId: string,
    recipientType: "customer" | "serviceProvider",
    limit: number = 10
  ) {
    return await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          eq(notifications.recipientType, recipientType)
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async deleteOldNotifications(daysOld: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await db
      .delete(notifications)
      .where(sql`${notifications.createdAt} < ${cutoffDate}`)
      .returning();

    return result.length;
  }
}

export const notificationRepository = new NotificationRepository()