import { deleteInactiveServiceProviderAccounts } from "#drizzleControllers/serviceProvider.controller.js";
import { deleteInactiveCustomerAccounts } from "#drizzleControllers/customer.controller.js";
import { authService } from "#drizzleServices/auth.service.js";

// Start all scheduled jobs
export const startJobs = () => {
  // Run cleanup every 24 hours for deleting customer accounts
  setInterval(deleteInactiveCustomerAccounts, 24 * 60 * 60 * 1000);

  // Run cleanup every 24 hours for deleting service provider accounts
  setInterval(deleteInactiveServiceProviderAccounts, 24 * 60 * 60 * 1000);

  // Cleanup expired refresh tokens - run daily
  setInterval(async () => {
    try {
      const deletedCount = await authService.cleanupExpiredTokens();
      if (deletedCount > 0) {
        console.log(`[Jobs] Cleaned up ${deletedCount} expired tokens`);
      }
    } catch (error) {
      console.error("[Jobs] Error cleaning up tokens:", error);
    }
  }, 24 * 60 * 60 * 1000);

  // Run cleanup once on server start (with delay for DB connection)
  setTimeout(() => {
    console.log("[Jobs] Starting scheduled cleanup...");
    deleteInactiveCustomerAccounts();
    deleteInactiveServiceProviderAccounts();
    // Cleanup expired tokens on startup
    authService.cleanupExpiredTokens();
  }, 5000);

  console.log("[Jobs] All scheduled jobs started");
};
