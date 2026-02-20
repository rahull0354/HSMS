import db from "#db/index.js";
import { NewServiceRequest, serviceRequests } from "#db/schema.js";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

export class ServiceRequestRepository {
  async findById(id: string) {
    const result = await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, id))
      .limit(1);

    return result[0] || null;
  }

  async create(data: NewServiceRequest) {
    const result = await db.insert(serviceRequests).values(data).returning();

    return result[0] || null;
  }

  async update(id: string, data: Partial<NewServiceRequest>) {
    const result = await db
      .update(serviceRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(serviceRequests.id, id))
      .returning();

    return result[0] || null;
  }

  async findByCustomerId(customerId: string) {
    return await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.customerId, customerId))
      .orderBy(desc(serviceRequests.createdAt));
  }

  async findByProviderId(providerId: string) {
    return await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.serviceProviderId, providerId))
      .orderBy(desc(serviceRequests.createdAt));
  }

  async updateStatus(id: string, status: string) {
    const request = await this.findById(id);
    if (!request) return null;

    return await this.update(id, {
      status,
      ...(status === "completed" ? { completedAt: new Date() } : {}),
    });
  }

  //   finding un-assigned requests
  async findUnassignedRequests(filters?: {
    serviceCategoryIds?: string[];
    cities?: string[];
    status?: string;
  }) {
    const conditions = [isNull(serviceRequests.serviceProviderId)];

    if (filters?.serviceCategoryIds && filters.serviceCategoryIds.length > 0) {
      conditions.push(
        inArray(serviceRequests.serviceCategoryId, filters.serviceCategoryIds),
      );
    }

    if (filters?.cities && filters.cities.length > 0) {
      conditions.push(
        sql`${serviceRequests.serviceAddress}->>'city' = any(${filters.cities})`,
      );
    }

    if (filters?.status) {
      conditions.push(eq(serviceRequests.status, filters.status));
    }

    return await db
      .select()
      .from(serviceRequests)
      .where(and(...conditions))
      .orderBy(desc(serviceRequests.createdAt));
  }

  async findByStatus(status: string) {
    return await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.status, status))
      .orderBy(desc(serviceRequests.createdAt));
  }

  async findByServiceCategories(
    categoryIds: string[],
    additionalFilters?: {
      status?: string;
      city?: string;
    },
  ) {
    const conditions = [
      inArray(serviceRequests.serviceCategoryId, categoryIds),
    ];

    if (additionalFilters?.status) {
      conditions.push(eq(serviceRequests.status, additionalFilters.status));
    }

    if (additionalFilters?.city) {
      conditions.push(
        sql`${serviceRequests.serviceAddress}->>'city' = ${additionalFilters.city}`,
      );
    }

    return await db
      .select()
      .from(serviceRequests)
      .where(and(...conditions))
      .orderBy(desc(serviceRequests.createdAt));
  }

  async findByCity(
    city: string,
    additionalFilters?: {
      status?: string;
    },
  ) {
    const conditions = [
      sql`${serviceRequests.serviceAddress}->>'city' = ${city.toLowerCase()}`,
    ];

    if (additionalFilters?.status) {
      conditions.push(eq(serviceRequests.status, additionalFilters.status));
    }

    return await db
      .select()
      .from(serviceRequests)
      .where(and(...conditions))
      .orderBy(desc(serviceRequests.createdAt));
  }

  async cancelRequest(
    id: string,
    cancellationData: {
      reason: string;
      cancelledBy: "customer" | "service_provider" | "admin";
    },
  ) {
    const request = await this.findById(id);
    if (!request) return null;

    return await this.update(id, {
      status: "cancelled",
      cancellationReason: cancellationData.reason,
      cancelledBy: cancellationData.cancelledBy,
      cancelledAt: new Date(),
    });
  }

  async updatePaymentStatus(
    id: string,
    paymentStatus: "pending" | "paid" | "refunded",
    paymentMethod?: string,
  ) {
    const request = await this.findById(id);
    if (!request) return null;

    return await this.update(id, {
      paymentStatus,
      ...(paymentMethod && { paymentMethod }),
    });
  }

  async addStatusHistory(
    id: string,
    historyEntry: {
      status: string;
      note: string;
      updatedBy: "customer" | "service_provider" | "admin";
    },
  ) {
    const request = await this.findById(id);
    if (!request) return null;

    const newHistoryEntry = {
      status: historyEntry.status,
      timestamp: new Date(),
      note: historyEntry.note,
      updatedBy: historyEntry.updatedBy,
    };

    const currentHistory = (request.statusHistory as any[]) || [];

    return await this.update(id, {
      statusHistory: [...currentHistory, newHistoryEntry],
    });
  }

  //   get count of requests grouped by status for a specific user
  async getStatusStatistics(userId: string, userType: "customer" | "provider") {
    const field =
      userType === "customer"
        ? serviceRequests.customerId
        : serviceRequests.serviceProviderId;

    const requests = await db
      .select({
        status: serviceRequests.status,
      })
      .from(serviceRequests)
      .where(eq(field, userId));

    const stats = {
      total: requests.length,
      requested: 0,
      assigned: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
    };

    requests.forEach((request) => {
      switch (request.status) {
        case "requested":
          stats.requested++;
          break;
        case "assigned":
          stats.assigned++;
          break;
        case "in_progress":
          stats.inProgress++;
          break;
        case "completed":
          stats.completed++;
          break;
        case "cancelled":
          stats.cancelled++;
          break;
      }
    });
    return stats;
  }

  async assignProvider(
    requestId: string,
    providerId: string,
    providerName: string,
  ) {
    const request = await this.findById(requestId);
    if (!request) return null;

    // get current history
    const currentHistory = (request.statusHistory as any[]) || [];

    const newHistory = {
      status: "assigned",
      timestamp: new Date(),
      note: `Request accepted by service provider ${providerName}`,
      updatedBy: "service_provider" as const,
    };

    return await this.update(requestId, {
      serviceProviderId: providerId,
      status: "assigned",
      statusHistory: [...currentHistory, newHistory],
    });
  }

  async updateAfterImages(requestId: string, images: string[]) {
    const request = await this.findById(requestId);
    if (!request) return null;

    return await this.update(requestId, {
      afterImages: images,
    });
  }

  async updateFinalPrice(
    requestId: string,
    finalPrice: number,
    pricingDetails?: {
      baseCharge?: number;
      additionalCharge?: number;
      breakdown?: string;
    },
  ) {
    const request = await this.findById(requestId);
    if (!request) return null;

    return await this.update(requestId, {
      finalPrice: finalPrice.toString(),
      ...(pricingDetails && { pricingDetails }),
    });
  }

  async findByStatusAndCustomerId(customerId: string, status: string) {
    return await db
      .select()
      .from(serviceRequests)
      .where(
        and(
          eq(serviceRequests.customerId, customerId),
          eq(serviceRequests.status, status),
        ),
      )
      .orderBy(desc(serviceRequests.createdAt));
  }

  async findByStatusAndProviderId(providerId: string, status: string) {
    return await db
      .select()
      .from(serviceRequests)
      .where(
        and(
          eq(serviceRequests.serviceProviderId, providerId),
          eq(serviceRequests.status, status),
        ),
      )
      .orderBy(desc(serviceRequests.createdAt));
  }

  async findByServiceCategory(
    categoryId: string,
    additionalFilters?: {
      status?: string;
      city?: string;
    },
  ) {
    const conditions = [eq(serviceRequests.serviceCategoryId, categoryId)];

    if (additionalFilters?.status) {
      conditions.push(eq(serviceRequests.status, additionalFilters.status));
    }

    if (additionalFilters?.city) {
      conditions.push(
        sql`${serviceRequests.serviceAddress}->>'city' = ${additionalFilters.city.toLocaleLowerCase()}`,
      );
    }

    return await db
      .select()
      .from(serviceRequests)
      .where(and(...conditions))
      .orderBy(desc(serviceRequests.createdAt));
  }

  async findCancellableRequests(
    userId: string,
    userType: "customer" | "provider",
  ) {
    const field =
      userType === "customer"
        ? serviceRequests.customerId
        : serviceRequests.serviceProviderId;

    return await db
      .select()
      .from(serviceRequests)
      .where(
        and(
          eq(field, userId),
          sql`${serviceRequests.status} = ANY(${["requested", "assigned"]})`,
        ),
      )
      .orderBy(desc(serviceRequests.createdAt));
  }

  async findByParentRequestId(parentRequestId: string) {
    return await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.parentRequestId, parentRequestId))
      .orderBy(desc(serviceRequests.createdAt));
  }

  async count(filters?: {
    customerId?: string;
    providerId?: string;
    status?: string;
    city?: string;
    serviceCategoryId?: string;
  }) {
    const conditions = [];

    if (filters?.customerId) {
      conditions.push(eq(serviceRequests.customerId, filters.customerId));
    }

    if (filters?.providerId) {
      conditions.push(
        eq(serviceRequests.serviceProviderId, filters.providerId),
      );
    }

    if (filters?.status) {
      conditions.push(eq(serviceRequests.status, filters.status));
    }

    if (filters?.city) {
      sql`${serviceRequests.serviceAddress}->>'city' = ${filters.city.toLowerCase()}`;
    }

    if (filters?.serviceCategoryId) {
      conditions.push(
        eq(serviceRequests.serviceCategoryId, filters.serviceCategoryId),
      );
    }

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(serviceRequests)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return Number(result[0]?.count || 0);
  }

  // if customer have any active services before deactivating the account
  async countActiveServices(customerId: string) {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(serviceRequests)
      .where(
        and(
          eq(serviceRequests.customerId, customerId),
          inArray(serviceRequests.status, ["requested", "assigned", "in_progress"])
        )
      );

    return Number(result[0]?.count || 0);
  }

  async findAllWithPagination(params: {
    filters?: {
      customerId?: string;
      providerId?: string;
      status?: string;
      city?: string;
      serviceCategoryId?: string;
    };
    pagination?: {
      page?: number;
      limit?: number;
    };
    sort?: {
      field?: string;
      order?: "asc" | "desc";
    };
  }) {
    const conditions = [];

    // build filter conditions
    if (params.filters?.customerId) {
      conditions.push(
        eq(serviceRequests.customerId, params.filters.customerId),
      );
    }

    if (params.filters?.providerId) {
      conditions.push(
        eq(serviceRequests.serviceProviderId, params.filters.providerId),
      );
    }

    if (params.filters?.status) {
      conditions.push(eq(serviceRequests.status, params.filters.status));
    }

    if (params.filters?.city) {
      conditions.push(
        sql`${serviceRequests.serviceAddress}->>'city' = ${params.filters.city.toLowerCase()}`,
      );
    }

    if (params.filters?.serviceCategoryId) {
      conditions.push(
        eq(serviceRequests.serviceCategoryId, params.filters.serviceCategoryId),
      );
    }

    // pagination
    const page = params.pagination?.page || 1;
    const limit = params.pagination?.limit || 10;
    const offset = (page - 1) * limit;

    // sorting
    const sortField = params.sort?.field || "createdAt";
    const sortOrder = params.sort?.order || "desc";

    const orderByField =
      sortField === "createdAt"
        ? serviceRequests.createdAt
        : sortField === "updatedAt"
          ? serviceRequests.updatedAt
          : serviceRequests.createdAt;

    const orderByClause =
      sortOrder === "asc" ? orderByField : desc(orderByField);

    const requests = await db
      .select()
      .from(serviceRequests)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(serviceRequests)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return {
      requests,
      pagination: {
        total: Number(totalResult[0]?.count || 0),
        page,
        limit,
        totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / limit),
        hasNext: page < Math.ceil(Number(totalResult[0]?.count || 0) / limit),
        hasPrev: page > 1,
      },
    };
  }
}

export const serviceRequestRepository = new ServiceRequestRepository();
