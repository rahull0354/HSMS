import db from "#db/index.js";
import { customers } from "#db/schema.js";
import { and, desc, eq, gt, gte, like, lt, lte, or, sql } from "drizzle-orm";
import type { NewCustomer } from "#db/schema.js";

export class CustomerRepository {
  async findByEmail(email: string) {
    const result = await db
      .select()
      .from(customers)
      .where(eq(customers.email, email))
      .limit(1);
    return result[0] || null;
  }

  async findById(id: string) {
    const result = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);
    return result[0] || null;
  }

  async create(data: NewCustomer) {
    const result = await db.insert(customers).values(data).returning();
    return result[0] || null;
  }

  async update(id: string, data: Partial<NewCustomer>) {
    const result = await db
      .update(customers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return result[0] || null;
  }

  async findAll(filters?: { isActive?: boolean; search?: string }) {
    const conditions = [];

    if (filters?.isActive !== undefined) {
      conditions.push(eq(customers.isActive, filters.isActive));
    }

    if (filters?.search) {
      conditions.push(
        or(
          like(customers.name, `%${filters.search}%`),
          like(customers.email, `%${filters.search}%`),
        ),
      );
    }

    const query = db.select().from(customers);

    if (conditions.length > 0) {
      return await query
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(desc(customers.createdAt));
    }

    return await query.orderBy(desc(customers.createdAt));
  }

  //   find customers by reactivationToken (that hasnt expired)
  async findByReactivationToken(token: string) {
    const result = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.reactivationToken, token),
          gt(customers.reactivationExpires, new Date()),
        ),
      )
      .limit(1);

    return result[0] || null;
  }

  async updateLastLogin(id: string) {
    const result = await db
      .update(customers)
      .set({ lastLogin: new Date() })
      .where(eq(customers.id, id))
      .returning();

    return result[0] || null;
  }

  //   delete customers with deactivated accounts for more than 30 days
  async deleteMany(filters: { isActive: boolean; deactivatedBefore: Date }) {
    const result = await db
      .delete(customers)
      .where(
        and(
          eq(customers.isActive, filters.isActive),
          lt(customers.deactivatedAt!, filters.deactivatedBefore),
        ),
      )
      .returning();

    return result;
  }

  async count(filters?: {
    isActive: boolean;
    createdAt?: { $gte?: Date; $lte?: Date };
  }) {
    const conditions = [];

    if (filters?.isActive !== undefined) {
      conditions.push(eq(customers.isActive, filters.isActive));
    }

    if (filters?.createdAt?.$gte && filters?.createdAt?.$lte) {
      conditions.push(
        and(
          gte(customers.createdAt, filters.createdAt.$gte),
          lte(customers.createdAt, filters.createdAt.$lte),
        ),
      );
    }

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return Number(result[0]?.count || 0);
  }
}

export const customerRepository = new CustomerRepository();