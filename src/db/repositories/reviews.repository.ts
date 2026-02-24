import db from "#db/index.js";
import { NewReview, reviews, serviceProviders, serviceRequests } from "#db/schema.js";
import { and, desc, eq, ilike, sql } from "drizzle-orm";

export class ReviewsRepository {
  async create(data: NewReview) {
    const result = await db
      .insert(reviews)
      .values({
        serviceRequestId: data.serviceRequestId,
        customerId: data.customerId,
        serviceProviderId: data.serviceProviderId,
        rating: data.rating,
        comment: data.comment || "",
        detailedRatings: data.detailedRatings || {
          punctuality: 0,
          quality: 0,
          behaviour: 0,
          valueForMoney: 0,
        },
        isVisible: data.isVisible ?? true,
        isFlagged: data.isFlagged ?? false,
      })
      .returning();

    return result[0] || null;
  }

  async findById(id: string) {
    const result = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findByRequestId(requestId: string) {
    const result = await db
      .select()
      .from(reviews)
      .where(eq(reviews.serviceRequestId, requestId))
      .limit(1);

    return result[0] || null;
  }

  async update(id: string, data: Partial<NewReview>) {
    const result = await db
      .update(reviews)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(reviews.id, id))
      .returning();

    return result[0] || null;
  }

  async delete(id: string) {
    const result = await db
      .delete(reviews)
      .where(eq(reviews.id, id))
      .returning();

    return result[0] || null;
  }

  async addProviderResponse(id: string, comment: string) {
    const result = await db
      .update(reviews)
      .set({
        providerResponse: {
          comment: comment,
          respondedAt: new Date(),
        },
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, id))
      .returning();

    return result[0] || null;
  }

  async findByCustomer(
    customerId: string,
    pagination?: {
      page?: number;
      limit?: number;
    },
    filters?: {
      rating?: number;
      sortBy?: string;
      order?: "asc" | "desc";
    }
  ) {
    const conditions = [eq(reviews.customerId, customerId)];

    if (filters?.rating) {
      conditions.push(eq(reviews.rating, filters.rating));
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const offset = (page - 1) * limit;

    const sortBy = filters?.sortBy || "createdAt";
    const order = filters?.order || "desc";

    const orderByField =
      sortBy === "rating"
        ? reviews.rating
        : sortBy === "updatedAt"
          ? reviews.updatedAt
          : reviews.createdAt;

    const orderByClause = order === "asc" ? orderByField : desc(orderByField);

    const reviewsList = await db
      .select()
      .from(reviews)
      .where(and(...conditions))
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(and(...conditions));

    return {
      reviews: reviewsList,
      total: Number(totalResult[0]?.count || 0),
      page,
      limit,
      totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / limit),
    };
  }

  async findByCustomerWithDetails(
    customerId: string,
    pagination?: { page?: number; limit?: number },
    filters?: { rating?: number; sortBy?: string; order?: "asc" | "desc" }
  ) {
    const conditions = [eq(reviews.customerId, customerId)];

    if (filters?.rating) {
      conditions.push(eq(reviews.rating, filters.rating));
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const offset = (page - 1) * limit;

    const sortBy = filters?.sortBy || "createdAt";
    const order = filters?.order || "desc";

    const orderByField =
      sortBy === "rating"
        ? reviews.rating
        : sortBy === "updatedAt"
          ? reviews.updatedAt
          : reviews.createdAt;

    const orderByClause = order === "asc" ? orderByField : desc(orderByField);

    const reviewsList = await db
      .select({
        // Review fields
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        detailedRatings: reviews.detailedRatings,
        providerResponse: reviews.providerResponse,
        isVisible: reviews.isVisible,
        isFlagged: reviews.isFlagged,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        // Provider fields
        serviceProviderId: serviceProviders.id,
        providerName: serviceProviders.name,
        providerEmail: serviceProviders.email,
        providerProfilePicture: serviceProviders.profilePicture,
        // Request fields
        serviceRequestId: serviceRequests.id,
        serviceTitle: serviceRequests.serviceTitle,
        serviceAddress: serviceRequests.serviceAddress,
      })
      .from(reviews)
      .innerJoin(serviceProviders, eq(reviews.serviceProviderId, serviceProviders.id))
      .innerJoin(serviceRequests, eq(reviews.serviceRequestId, serviceRequests.id))
      .where(and(...conditions))
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(and(...conditions));

    return {
      reviews: reviewsList,
      total: Number(totalResult[0]?.count || 0),
      page,
      limit,
      totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / limit),
    };
  }

  async findByProvider(
    providerId: string,
    pagination?: {
      page?: number;
      limit?: number;
    },
    filters?: {
      rating?: number;
      sortBy?: string;
      order?: "asc" | "desc";
    }
  ) {
    const conditions = [
      eq(reviews.serviceProviderId, providerId),
      eq(reviews.isVisible, true),
    ];

    if (filters?.rating) {
      conditions.push(eq(reviews.rating, filters.rating));
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const offset = (page - 1) * limit;

    const sortBy = filters?.sortBy || "createdAt";
    const order = filters?.order || "desc";

    const orderByField =
      sortBy === "rating"
        ? reviews.rating
        : sortBy === "updatedAt"
          ? reviews.updatedAt
          : reviews.createdAt;

    const orderByClause = order === "asc" ? orderByField : desc(orderByField);

    const reviewsList = await db
      .select()
      .from(reviews)
      .where(and(...conditions))
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(and(...conditions));

    return {
      reviews: reviewsList,
      total: Number(totalResult[0]?.count || 0),
      page,
      limit,
      totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / limit),
    };
  }

  async flagReview(id: string, reason: string, hideReview: boolean = false) {
    const result = await db
      .update(reviews)
      .set({
        isFlagged: true,
        flagReason: reason,
        isVisible: hideReview ? false : true,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, id))
      .returning();

    return result[0] || null;
  }

  async unflagReview(id: string) {
    const result = await db
      .update(reviews)
      .set({
        isFlagged: false,
        flagReason: null,
        isVisible: true,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, id))
      .returning();

    return result[0] || null;
  }

  async toggleVisibility(id: string, isVisible?: boolean) {
    const review = await this.findById(id);
    if (!review) return null;

    const newVisibility = isVisible !== undefined ? isVisible : !review.isVisible;

    const result = await db
      .update(reviews)
      .set({
        isVisible: newVisibility,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, id))
      .returning();

    return result[0] || null;
  }

  async countByProvider(providerId: string, visibleOnly: boolean = true) {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(
        visibleOnly
          ? and(
              eq(reviews.serviceProviderId, providerId),
              eq(reviews.isVisible, true)
            )
          : eq(reviews.serviceProviderId, providerId)
      );

    return Number(result[0]?.count || 0);
  }

  async countByCustomer(customerId: string) {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(eq(reviews.customerId, customerId));

    return Number(result[0]?.count || 0);
  }

  async getAverageRating(providerId: string) {
    const result = await db
      .select({
        avgRating: sql<number>`AVG(${reviews.rating})`,
      })
      .from(reviews)
      .where(
        and(
          eq(reviews.serviceProviderId, providerId),
          eq(reviews.isVisible, true)
        )
      );

    const avgRating = result[0]?.avgRating;
    if (avgRating === null || avgRating === undefined) {
      return 0;
    }

    // Convert to number and round to 2 decimal places
    return Math.round(Number(avgRating) * 100) / 100;
  }

  async getRatingDistribution(providerId: string) {
    const result = await db
      .select({
        rating: reviews.rating,
        count: sql<number>`count(*)`,
      })
      .from(reviews)
      .where(
        and(
          eq(reviews.serviceProviderId, providerId),
          eq(reviews.isVisible, true)
        )
      )
      .groupBy(reviews.rating);

    const distribution = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    result.forEach((item) => {
      distribution[item.rating as keyof typeof distribution] = item.count;
    });

    return distribution;
  }

  async getProviderStats(providerId: string) {
    const totalReviews = await this.countByProvider(providerId, false);
    const visibleReviews = await this.countByProvider(providerId, true);
    const averageRating = await this.getAverageRating(providerId);
    const distribution = await this.getRatingDistribution(providerId);

    const hasResponse = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(
        and(
          eq(reviews.serviceProviderId, providerId),
          sql`${reviews.providerResponse} IS NOT NULL`
        )
      );

    return {
      totalReviews,
      visibleReviews,
      hiddenReviews: totalReviews - visibleReviews,
      averageRating,
      ratingDistribution: distribution,
      respondedReviews: Number(hasResponse[0]?.count || 0),
    };
  }

  async findAll(
    pagination?: {
      page?: number;
      limit?: number;
    },
    filters?: {
      rating?: number;
      isFlagged?: boolean;
      isVisible?: boolean;
      sortBy?: string;
      order?: "asc" | "desc";
    }
  ) {
    const conditions = [];

    if (filters?.rating) {
      conditions.push(eq(reviews.rating, filters.rating));
    }

    if (filters?.isFlagged !== undefined) {
      conditions.push(eq(reviews.isFlagged, filters.isFlagged));
    }

    if (filters?.isVisible !== undefined) {
      conditions.push(eq(reviews.isVisible, filters.isVisible));
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const offset = (page - 1) * limit;

    const sortBy = filters?.sortBy || "createdAt";
    const order = filters?.order || "desc";

    const orderByField =
      sortBy === "rating"
        ? reviews.rating
        : sortBy === "isFlagged"
          ? reviews.isFlagged
          : sortBy === "updatedAt"
            ? reviews.updatedAt
            : reviews.createdAt;

    const orderByClause = order === "asc" ? orderByField : desc(orderByField);

    const reviewsList = await db
      .select()
      .from(reviews)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return {
      reviews: reviewsList,
      total: Number(totalResult[0]?.count || 0),
      page,
      limit,
      totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / limit),
    };
  }

  async getOverallStats() {
    const totalReviews = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews);

    const visibleReviews = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(eq(reviews.isVisible, true));

    const hiddenReviews = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(eq(reviews.isVisible, false));

    const flaggedReviews = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(eq(reviews.isFlagged, true));

    const averageRating = await db
      .select({
        avg: sql<number>`AVG(${reviews.rating})`,
      })
      .from(reviews)
      .where(eq(reviews.isVisible, true));

    const ratingDistribution = await db
      .select({
        rating: reviews.rating,
        count: sql<number>`count(*)`,
      })
      .from(reviews)
      .groupBy(reviews.rating);

    const distribution = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    ratingDistribution.forEach((item) => {
      distribution[item.rating as keyof typeof distribution] = item.count;
    });

    return {
      totalReviews: Number(totalReviews[0]?.count || 0),
      visibleReviews: Number(visibleReviews[0]?.count || 0),
      hiddenReviews: Number(hiddenReviews[0]?.count || 0),
      flaggedReviews: Number(flaggedReviews[0]?.count || 0),
      averageRating: averageRating[0]?.avg ? Math.round(Number(averageRating[0].avg) * 100) / 100 : 0,
      ratingDistribution: distribution,
    };
  }

  async countHiddenReviews() {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(eq(reviews.isVisible, false));

    return Number(result[0]?.count || 0);
  }

  
}

export const reviewsRepository = new ReviewsRepository();
