import jwt from "jsonwebtoken";
import crypto from "crypto";
import { refreshTokenRepository } from "#db/repositories/refreshToken.repository.js";
import { customerRepository } from "#db/repositories/customer.repository.js";
import { serviceProviderRepository } from "#db/repositories/serviceProvider.repository.js";
import { adminRepository } from "#db/repositories/admin.repository.js";
import type { Request } from "express";

// Token configuration
const ACCESS_TOKEN_EXPIRY = "1h"; // 1 hour
const REFRESH_TOKEN_EXPIRY_DAYS = 7; // 7 days

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface DeviceInfo {
  browser?: string;
  os?: string;
  device?: string;
  userAgent?: string;
}

class AuthService {
  // Extract device info from request
  private extractDeviceInfo(req: Request): DeviceInfo {
    const userAgent = req.headers["user-agent"] || "";

    // Simple user agent parsing
    let browser = "Unknown";
    let os = "Unknown";
    let device = "Desktop";

    if (userAgent.includes("Chrome")) browser = "Chrome";
    else if (userAgent.includes("Firefox")) browser = "Firefox";
    else if (userAgent.includes("Safari")) browser = "Safari";
    else if (userAgent.includes("Edge")) browser = "Edge";

    if (userAgent.includes("Windows")) os = "Windows";
    else if (userAgent.includes("Mac")) os = "MacOS";
    else if (userAgent.includes("Linux")) os = "Linux";
    else if (userAgent.includes("Android")) os = "Android";
    else if (userAgent.includes("iOS")) os = "iOS";

    if (
      userAgent.includes("Mobile") ||
      userAgent.includes("Android") ||
      userAgent.includes("iPhone")
    ) {
      device = "Mobile";
    } else if (userAgent.includes("Tablet") || userAgent.includes("iPad")) {
      device = "Tablet";
    }

    return { browser, os, device, userAgent };
  }

  // Extract IP address
  private extractIpAddress(req: Request): string {
    return (
      (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
      (req.headers["x-real-ip"] as string) ||
      req.socket.remoteAddress ||
      "unknown"
    );
  }

  // Generate both access and refresh tokens
  async generateTokens(
    userId: string,
    userType: "customer" | "serviceProvider" | "admin",
    req: Request,
  ): Promise<TokenPair> {
    // Generate access token (1 hour expiry)
    const accessToken = jwt.sign(
      { id: userId, role: userType },
      process.env.JWT_SECRET_KEY || "secret",
      { expiresIn: ACCESS_TOKEN_EXPIRY },
    );

    // Generate refresh token (random string, 7 days expiry)
    const refreshToken = crypto.randomBytes(64).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    // Extract device info and IP
    const deviceInfo = this.extractDeviceInfo(req);
    const ipAddress = this.extractIpAddress(req);

    // Store refresh token in database
    await refreshTokenRepository.create({
      userId,
      userType,
      token: refreshToken,
      expiresAt,
      deviceInfo,
      ipAddress,
      tokenVersion: 0,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600,
    };
  }

  // Refresh access token using refresh token (with rotation)
  async refreshAccessToken(
    refreshToken: string,
    req: Request,
  ): Promise<{
    success: boolean;
    tokens?: TokenPair;
    error?: string;
  }> {
    try {
      // Find and validate refresh token
      const tokenRecord =
        await refreshTokenRepository.findByToken(refreshToken);

      if (!tokenRecord) {
        return {
          success: false,
          error: "Invalid or expired refresh token",
        };
      }

      // Verify user still exists and is active
      let user: any;
      if (tokenRecord.userType === "customer") {
        user = await customerRepository.findById(tokenRecord.userId);
      } else if (tokenRecord.userType === "serviceProvider") {
        user = await serviceProviderRepository.findById(tokenRecord.userId);
      } else if (tokenRecord.userType === "admin") {
        user = await adminRepository.findById(tokenRecord.userId);
      }

      if (!user) {
        await refreshTokenRepository.revoke(refreshToken);
        return {
          success: false,
          error: "User not found",
        };
      }

      // Check if user is active (admins don't have isActive field, always active)
      if (
        tokenRecord.userType !== "admin" &&
        user.isActive === false
      ) {
        await refreshTokenRepository.revokeAllForUser(
          tokenRecord.userId,
          tokenRecord.userType,
        );
        return {
          success: false,
          error: "User account is inactive",
        };
      }

      // TOKEN ROTATION: Revoke old token and issue new one
      await refreshTokenRepository.revoke(refreshToken);

      // Generate new token pair
      const newTokens = await this.generateTokens(
        tokenRecord.userId,
        tokenRecord.userType as "customer" | "serviceProvider" | "admin",
        req,
      );

      return {
        success: true,
        tokens: newTokens,
      };
    } catch (error) {
      console.error("Refresh token error:", error);
      return {
        success: false,
        error: "Failed to refresh token",
      };
    }
  }

  // Revoke a specific refresh token
  async revokeRefreshToken(
    token: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const tokenRecord = await refreshTokenRepository.findByToken(token);

      if (!tokenRecord) {
        return {
          success: false,
          error: "Token not found or already revoked",
        };
      }

      if (tokenRecord.userId !== userId) {
        return {
          success: false,
          error: "Unauthorized",
        };
      }

      await refreshTokenRepository.revoke(token);
      return { success: true };
    } catch (error) {
      console.error("Revoke token error:", error);
      return {
        success: false,
        error: "Failed to revoke token",
      };
    }
  }

  // Get all active sessions for user
  async getUserActiveSessions(
    userId: string,
    userType: "customer" | "serviceProvider" | "admin",
  ) {
    try {
      const sessions = await refreshTokenRepository.findActiveByUser(
        userId,
        userType,
      );

      return sessions.map((session) => ({
        id: session.id,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        isCurrent: false, // Will be set by controller
      }));
    } catch (error) {
      console.error("Get sessions error:", error);
      return [];
    }
  }

  // Revoke specific session by ID
  async revokeSessionById(
    sessionId: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await refreshTokenRepository.revokeById(sessionId, userId);

      if (!result) {
        return {
          success: false,
          error: "Session not found",
        };
      }

      return { success: true };
    } catch (error) {
      console.error("Revoke session error:", error);
      return {
        success: false,
        error: "Failed to revoke session",
      };
    }
  }

  // Revoke all sessions (logout from all devices)
  async revokeAllSessions(
    userId: string,
    userType: "customer" | "serviceProvider" | "admin",
  ): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      const revokedTokens = await refreshTokenRepository.revokeAllForUser(
        userId,
        userType,
      );

      return {
        success: true,
        count: revokedTokens.length,
      };
    } catch (error) {
      console.error("Revoke all sessions error:", error);
      return {
        success: false,
        error: "Failed to revoke all sessions",
      };
    }
  }

  // Cleanup expired tokens (run periodically)
  async cleanupExpiredTokens() {
    try {
      const deleted = await refreshTokenRepository.deleteExpired();
      if (deleted.length > 0) {
        console.log(
          `[Cleanup] Deleted ${deleted.length} expired/revoked tokens`,
        );
      }
      return deleted.length;
    } catch (error) {
      console.error("[Cleanup] Error deleting expired tokens:", error);
      return 0;
    }
  }
}

export const authService = new AuthService();
