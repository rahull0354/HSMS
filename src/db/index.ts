import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL!;

// Configure postgres for serverless environments
const client = postgres(connectionString, {
  max: 1, // Limit connections for serverless
  idle_timeout: 20, // Close idle connections quickly
  connect_timeout: 10, // Quick timeout for serverless
});

export const db = drizzle(client);

export default db;
