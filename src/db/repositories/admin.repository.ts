import db from "#db/index.js";
import {
  admins,
  customers,
  NewAdmin,
  NewServiceCategory,
  serviceCategories,
  serviceProviders,
} from "#db/schema.js";
import { and, desc, eq, ilike, ne, or, sql } from "drizzle-orm";

export class AdminRepository {
  async findById(id: string) {
    const result = await db
      .select()
      .from(admins)
      .where(eq(admins.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findByEmail(email: string) {
    const result = await db
      .select()
      .from(admins)
      .where(eq(admins.email, email))
      .limit(1);

    return result;
  }

  async create(data: NewAdmin) {
    const result = await db.insert(admins).values(data).returning();

    return result[0] || null;
  }

  async updateLastLogin(id: string) {
    const result = await db
      .update(admins)
      .set({ lastLogin: new Date() })
      .where(eq(admins.id, id))
      .returning();

    return result[0] || null;
  }

  async count() {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(admins);
    return Number(result[0]?.count || 0);
  }

  //   service category functions

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

  //   service provider functions

  async findAllProviders(
    filters?: {
      isActive?: boolean;
      isSuspended?: boolean;
      search?: string;
    },
    pagination?: {
      page?: number;
      limit?: number;
    },
  ) {
    const conditions = [];

    if (filters?.isActive !== undefined) {
      conditions.push(eq(serviceProviders.isActive, filters.isActive));
    }

    if (filters?.isSuspended !== undefined) {
      conditions.push(eq(serviceProviders.isSuspended, filters.isSuspended));
    }

    if (filters?.search) {
      conditions.push(
        or(
          ilike(serviceProviders.name, `%${filters.search}%`),
          ilike(serviceProviders.email, `%${filters.search}%`),
        ),
      );
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const offset = (page - 1) * limit;

    const providers = await db
      .select({
        id: serviceProviders.id,
        name: serviceProviders.name,
        email: serviceProviders.email,
        phone: serviceProviders.phone,
        profilePicture: serviceProviders.profilePicture,
        bio: serviceProviders.bio,
        skills: serviceProviders.skills,
        experienceYears: serviceProviders.experienceYears,
        pricingType: serviceProviders.pricingType,
        availabilityStatus: serviceProviders.availabilityStatus,
        averageRating: serviceProviders.averageRating,
        totalReviews: serviceProviders.totalReviews,
        totalJobsCompleted: serviceProviders.totalJobsCompleted,
        isActive: serviceProviders.isActive,
        isSuspended: serviceProviders.isSuspended,
        createdAt: serviceProviders.createdAt,
        updatedAt: serviceProviders.updatedAt,
      })
      .from(serviceProviders)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(serviceProviders.createdAt))
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(serviceProviders)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return {
      providers,
      total: Number(totalResult[0]?.count || 0),
      page,
      limit,
      totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / limit),
    };
  }

  async countProviders(filters?: {
    isActive?: boolean;
    isSuspended?: boolean;
  }) {
    const conditions = [];

    if (filters?.isActive !== undefined) {
      conditions.push(eq(serviceProviders.isActive, filters.isActive));
    }

    if (filters?.isSuspended !== undefined) {
      conditions.push(eq(serviceProviders.isSuspended, filters.isSuspended));
    }

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(serviceProviders)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return Number(result[0]?.count || 0);
  }

  async findProviderById(id: string) {
    const result = await db
      .select()
      .from(serviceProviders)
      .where(eq(serviceProviders.id, id))
      .limit(1);

    return result[0] || null;
  }

  async suspendProviderAccount(id: string, reason: string) {
    const result = await db
      .update(serviceProviders)
      .set({
        isSuspended: true,
        isActive: false,
        suspensionReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(serviceProviders.id, id))
      .returning();

    return result[0] || null;
  }

  async unsuspendProviderAccount(id: string) {
    const result = await db
      .update(serviceProviders)
      .set({
        isSuspended: false,
        isActive: true,
        suspensionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(serviceProviders.id, id))
      .returning();

    return result[0] || null;
  }

  //   customer functions
  async findAllCustomers(
    filters?: {
      isActive?: boolean;
      search?: string;
    },
    pagination?: {
      page?: number;
      limit?: number;
    },
  ) {
    const conditions = [];

    if (filters?.isActive !== undefined) {
      conditions.push(eq(customers.isActive, filters.isActive));
    }

    if (filters?.search) {
      conditions.push(
        or(
          ilike(customers.name, `%${filters.search}%`),
          ilike(customers.email, `%${filters.search}%`),
        ),
      );
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const offset = (page - 1) * limit;

    const customerData = await db
      .select({
        id: customers.id,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        profilePicture: customers.profilePicture,
        isActive: customers.isActive,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
      })
      .from(customers)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(customers.createdAt))
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return {
      customers: customerData,
      total: Number(totalResult[0]?.count || 0),
      page,
      limit,
      totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / limit),
    };
  }

  async countCustomers(filters?: { isActive?: boolean }) {
    const conditions = [];

    if (filters?.isActive !== undefined) {
      conditions.push(eq(customers.isActive, filters.isActive));
    }

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return Number(result[0]?.count || 0);
  }

  async findCustomerById(id: string) {
    const result = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);

    return result[0] || null;
  }
}
