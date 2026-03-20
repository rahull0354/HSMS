import db from "#db/index.js";
import { NewServiceCategory, serviceCategories } from "#db/schema.js";
import { and, eq, ne, or, sql } from "drizzle-orm";

export class ServiceCategoryRepository {
  async findCategoryByNameOrSlug(name: string, slug: string) {
    const result = await db
      .select()
      .from(serviceCategories)
      .where(
        or(eq(serviceCategories.name, name), eq(serviceCategories.slug, slug)),
      )
      .limit(1);

    return result[0] || null;
  }

  async createCategory(data: NewServiceCategory) {
    const result = await db.insert(serviceCategories).values(data).returning();

    return result[0] || null;
  }

  async findAllCategories(
    filters?: {
      isActive?: boolean;
    },
    pagination?: {
      page?: number;
      limit?: number;
    },
  ) {
    const conditions = [];

    if (filters?.isActive !== undefined) {
      conditions.push(eq(serviceCategories.isActive, filters.isActive));
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const offset = (page - 1) * limit;

    const categories = await db
      .select()
      .from(serviceCategories)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(serviceCategories)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return {
      categories,
      total: Number(totalResult[0]?.count || 0),
      page,
      limit,
      totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / limit),
    };
  }

  async countCategories(filters?: { isActive?: boolean }) {
    const conditions = [];

    if (filters?.isActive !== undefined) {
      conditions.push(eq(serviceCategories.isActive, filters.isActive));
    }

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(serviceCategories)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return Number(result[0]?.count || 0);
  }

  async findCategoryById(id: string) {
    const result = await db
      .select()
      .from(serviceCategories)
      .where(eq(serviceCategories.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findById(id: string) {
    const result = await db
      .select()
      .from(serviceCategories)
      .where(eq(serviceCategories.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findCategoryBySlug(slug: string) {
    const result = await db
      .select()
      .from(serviceCategories)
      .where(eq(serviceCategories.slug, slug))
      .limit(1);

    return result[0] || null;
  }

  async updateCategoryById(id: string, data: Partial<NewServiceCategory>) {
    const result = await db
      .update(serviceCategories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(serviceCategories.id, id))
      .returning();

    return result[0] || null;
  }

  async checkCategoryNameExists(name: string, excludeId?: string) {
    const conditions = [eq(serviceCategories.name, name)];

    if (excludeId) {
      conditions.push(ne(serviceCategories.id, excludeId));
    }

    const result = await db
      .select()
      .from(serviceCategories)
      .where(and(...conditions))
      .limit(1);

    return result[0] || null;
  }

  async checkCategorySlugExists(slug: string, excludeId?: string) {
    const conditions = [eq(serviceCategories.slug, slug)];

    if (excludeId) {
      conditions.push(ne(serviceCategories.id, excludeId));
    }

    const result = await db
      .select()
      .from(serviceCategories)
      .where(and(...conditions))
      .limit(1);

    return result[0] || null;
  }

  async toggleCategoryStatus(id: string) {
    const category = await this.findCategoryById(id);
    if (!category) return null;

    const result = await db
      .update(serviceCategories)
      .set({ isActive: !category.isActive, updatedAt: new Date() })
      .where(eq(serviceCategories.id, id))
      .returning();

    return result[0] || null;
  }

  async deleteCategory(id: string) {
    const result = await db
      .delete(serviceCategories)
      .where(eq(serviceCategories.id, id))
      .returning();

    return result[0] || null;
  }
}

export const serviceCategory = new ServiceCategoryRepository();
