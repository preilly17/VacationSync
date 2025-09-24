// @ts-nocheck
// server/db.ts
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create a connection pool for queries
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Render requires SSL
});

// Small helper function so other files can do: await query(...)
export const query = <T>(text: string, params: unknown[] = []) => {
  return pool.query<T>(text, params);
};
