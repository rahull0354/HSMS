import db from "#db/index.js";
import { NewServiceProvider, serviceProviders } from "#db/schema.js";
import { and, desc, eq, gt, gte, like, lt, lte, or, sql } from "drizzle-orm";

export class ServiceProviderRepository {
  async findByEmail(email: string) {
    const result = await db
      .select()
      .from(serviceProviders)
      .where(eq(serviceProviders.email, email))
      .limit(1);

    return result[0] || null;
  }

  async findById(id: string) {
    const result = await db
      .select()
      .from(serviceProviders)
      .where(eq(serviceProviders.id, id))
      .limit(1);

    return result[0] || null;
  }

  async create(data: NewServiceProvider) {
    const result = await db.insert(serviceProviders).values(data).returning();

    return result[0] || null;
  }

  async update(id: string, data: Partial<NewServiceProvider>) {
    const result = await db
      .update(serviceProviders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(serviceProviders.id, id))
      .returning();

    return result[0] || null;
  }

  async findAll(filters?: {
    isActive?: boolean;
    availabilityStatus?: string;
    search?: string;
  }) {
    const conditions = [];

    if (filters?.isActive !== undefined) {
      conditions.push(eq(serviceProviders.isActive, filters.isActive));
    }

    if (filters?.availabilityStatus) {
      conditions.push(
        eq(serviceProviders.availabilityStatus, filters.availabilityStatus),
      );
    }

    if (filters?.search) {
      conditions.push(
        or(
          like(serviceProviders.name, `%${filters.search}%`),
          like(serviceProviders.email, `%${filters.search}%`),
        ),
      );
    }

    const query = db.select().from(serviceProviders);

    if (conditions.length > 0) {
      return await query
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(desc(serviceProviders.createdAt));
    }

    return await query.orderBy(desc(serviceProviders.createdAt));
  }

  async findByReactivationToken(token: string) {
    const result = await db
      .select()
      .from(serviceProviders)
      .where(
        and(
          eq(serviceProviders.reactivationToken, token),
          gt(serviceProviders.reactivationExpires, new Date()),
        ),
      )
      .limit(1);

    return result[0] || null;
  }

  async updateLastLogin(id: string) {
    const result = await db
      .update(serviceProviders)
      .set({ lastLogin: new Date() })
      .where(eq(serviceProviders.id, id))
      .returning();

    return result[0] || null;
  }

  //   update stats when new ratings are added
  async updateRatingStats(
    id: string,
    data: { averageRating: string; totalReviews: number },
  ) {
    const result = await db
      .update(serviceProviders)
      .set(data)
      .where(eq(serviceProviders.id, id))
      .returning();

    return result[0] || null;
  }

  async incrementJobsCompleted(id: string) {
    const result = await db
      .update(serviceProviders)
      .set({
        totalJobsCompleted: sql`${serviceProviders.totalJobsCompleted} + 1`,
      })
      .where(eq(serviceProviders.id, id))
      .returning();

    return result[0] || null;
  }

  //   deleting accounts after 30 days grace period
  async deleteMany(filters: { isActive: boolean; deactivateBefore: Date }) {
    const result = await db
      .delete(serviceProviders)
      .where(
        and(
          eq(serviceProviders.isActive, filters.isActive),
          lt(serviceProviders.deactivatedAt!, filters.deactivateBefore),
        ),
      )
      .returning();

    return result;
  }

  //   count with filters
  async count(filters?: {
    isActive?: boolean;
    isSuspended?: boolean;
    createdAt?: { gte?: Date; lte?: Date };
  }) {
    const conditions = [];

    if (filters?.isActive !== undefined) {
      conditions.push(eq(serviceProviders.isActive, filters.isActive));
    }

    if (filters?.isSuspended !== undefined) {
      conditions.push(eq(serviceProviders.isSuspended, filters.isSuspended));
    }

    if (filters?.createdAt?.gte && filters?.createdAt?.lte) {
      conditions.push(
        and(
          gte(serviceProviders.createdAt, filters.createdAt.gte),
          lte(serviceProviders.createdAt, filters.createdAt.lte),
        ),
      );
    }

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(serviceProviders)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return Number(result[0]?.count || 0);
  }

  //   find by skills
  async findBySkill(skill: string) {
    const result = await db
      .select()
      .from(serviceProviders)
      .where(
        and(
          eq(serviceProviders.isActive, true),
          eq(serviceProviders.isSuspended, false),
          sql`${serviceProviders.skills} @> ${sql`[${JSON.stringify(skill)}]::jsonb`}`
        ),
      );

    return result;
  }
}

export const serviceProviderRepository = new ServiceProviderRepository()