import db from "#db/index.js";
import { refreshTokens, type NewRefreshToken } from "#db/schema.js";
import { and, eq, gt, or, sql, desc, lt } from "drizzle-orm";

export class RefreshTokenRepository {
  // Create new refresh token
  async create(data: NewRefreshToken) {
    const result = await db.insert(refreshTokens).values(data).returning();
    return result[0] || null;
  }

  // Find by token (for validation)
  async findByToken(token: string) {
    const result = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.token, token),
          eq(refreshTokens.revoked, false),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return result[0] || null;
  }

  // Revoke specific token
  async revoke(token: string) {
    const result = await db
      .update(refreshTokens)
      .set({
        revoked: true,
        revokedAt: new Date(),
      })
      .where(eq(refreshTokens.token, token))
      .returning();
    return result[0] || null;
  }

  // Revoke all tokens for a user (logout from all devices)
  async revokeAllForUser(userId: string, userType: string) {
    const result = await db
      .update(refreshTokens)
      .set({
        revoked: true,
        revokedAt: new Date(),
      })
      .where(
        and(
          eq(refreshTokens.userId, userId),
          eq(refreshTokens.userType, userType),
          eq(refreshTokens.revoked, false),
        ),
      )
      .returning();
    return result;
  }

  // Get active sessions for user
  async findActiveByUser(userId: string, userType: string) {
    const result = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.userId, userId),
          eq(refreshTokens.userType, userType),
          sql`${refreshTokens.revoked} = false OR ${refreshTokens.revoked} IS NULL`,
          gt(refreshTokens.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(refreshTokens.createdAt));

    const activeOnly = result.filter(session => !session.revoked && new Date(session.expiresAt) > new Date());
    return activeOnly;
  }

  // Revoke specific token by ID
  async revokeById(tokenId: string, userId: string) {
    const result = await db
      .update(refreshTokens)
      .set({
        revoked: true,
        revokedAt: new Date(),
      })
      .where(
        and(eq(refreshTokens.id, tokenId), eq(refreshTokens.userId, userId)),
      )
      .returning();
    return result[0] || null;
  }

  // Delete expired tokens (cleanup job)
  async deleteExpired() {
    try {
      const result = await db
        .delete(refreshTokens)
        .where(
          or(
            sql`${refreshTokens.expiresAt} < NOW()`,
            and(
              eq(refreshTokens.revoked, true),
              sql`${refreshTokens.revokedAt} < NOW() - INTERVAL '30 days'`,
            ),
          ),
        )
        .returning();
      return result;
    } catch (error: any) {
      // If table doesn't exist or other error, log but don't crash
      if (error.message) {
        console.warn('[RefreshToken] Cleanup error (non-critical):', error.message);
      }
      return [];
    }
  }

  // Count active tokens for user
  async countActiveTokens(userId: string, userType: string) {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.userId, userId),
          eq(refreshTokens.userType, userType),
          eq(refreshTokens.revoked, false),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      );
    return Number(result[0]?.count || 0);
  }
}

export const refreshTokenRepository = new RefreshTokenRepository();
