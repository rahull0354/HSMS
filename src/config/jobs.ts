import { deleteInactiveServiceProviderAccounts } from "#controllers/serviceProvider.controller.js";
import { deleteInactiveCustomerAccounts } from "#controllers/user.controller.js";

// Start all scheduled jobs
export const startJobs = () => {
  // Run cleanup every 24 hours for deleting customer accounts
  setInterval(deleteInactiveCustomerAccounts, 24 * 60 * 60 * 1000);

  // Run cleanup every 24 hours for deleting service provider accounts
  setInterval(deleteInactiveServiceProviderAccounts, 24 * 60 * 60 * 1000)

  // Run cleanup once on server start (with delay for DB connection)
  setTimeout(() => {
    console.log("[Jobs] Starting scheduled cleanup...");
    deleteInactiveCustomerAccounts();
    deleteInactiveServiceProviderAccounts()
  }, 5000);

  console.log("[Jobs] All scheduled jobs started");
};
