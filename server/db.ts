// @ts-nocheck
// server/db.ts
import { Pool } from "pg";

type QueryFunction = <T>(text: string, params?: unknown[]) => Promise<{ rows: T[] }>;

const globalAny = globalThis as { __TEST_DB_QUERY__?: QueryFunction };

let queryImpl: QueryFunction;

if (typeof globalAny.__TEST_DB_QUERY__ === "function") {
  queryImpl = globalAny.__TEST_DB_QUERY__;
} else if (process.env.JEST_WORKER_ID) {
  queryImpl = async () => ({ rows: [] });
} else {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  queryImpl = (text, params = []) => pool.query(text, params);
}

export const query: QueryFunction = (text, params = []) => queryImpl(text, params);
