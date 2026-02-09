import { deleteInactiveAccounts } from "#controllers/user.controller.js";

// Start all scheduled jobs
export const startJobs = () => {
  // Run cleanup every 24 hours
  setInterval(deleteInactiveAccounts, 24 * 60 * 60 * 1000);

  // Run cleanup once on server start (with delay for DB connection)
  setTimeout(() => {
    console.log("[Jobs] Starting scheduled cleanup...");
    deleteInactiveAccounts();
  }, 5000);

  console.log("[Jobs] All scheduled jobs started");
};
