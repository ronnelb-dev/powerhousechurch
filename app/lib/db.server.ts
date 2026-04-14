// app/lib/db.server.ts
// Prisma client configured for Neon PostgreSQL on Vercel.
//
// Architecture:
//   - Uses @neondatabase/serverless as the PostgreSQL driver
//   - Uses @prisma/adapter-neon as the Prisma driver adapter
//   - This replaces the standard node-postgres (pg) driver
//   - Required because Vercel Serverless Functions can't maintain persistent
//     TCP connections — Neon's driver uses HTTP/WebSocket instead
//
// Connection management:
//   - In development: singleton pattern prevents connection pool exhaustion
//     during Vite HMR hot reloads (same as before)
//   - In production (Vercel): each function invocation gets its own pool,
//     which Neon's PgBouncer connection pooler manages efficiently
//
// Environment variables required:
//   DATABASE_URL          → Neon pooled connection string (used at runtime)
//   DATABASE_URL_UNPOOLED → Neon direct connection string (used by Prisma CLI only)

import { Pool, neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

// In Node.js environments (Vercel Serverless Functions), WebSockets are
// not available natively. We must supply the ws package as the WebSocket
// constructor so Neon's driver can establish its connection.
// In Edge Functions (if you ever switch), this is not needed.
if (typeof WebSocket === "undefined") {
  // Dynamic import to avoid bundling ws in edge environments
  const { default: ws } = await import("ws").catch(() => ({ default: null }));
  if (ws) {
    neonConfig.webSocketConstructor = ws;
  }
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is not set. " +
      "Add it in Vercel Dashboard → Settings → Environment Variables."
    );
  }

  // The Neon adapter must be initialized with a Pool instance from @neondatabase/serverless
  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool);

  return new (PrismaClient as any)({
    adapter,
    log: process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
  });
}

// ── Singleton pattern for development (prevents HMR connection pool exhaustion)

declare global {
  // eslint-disable-next-line no-var
  var __db__: PrismaClient | undefined;
}

let db: PrismaClient;

if (process.env.NODE_ENV === "production") {
  // In production, create a new client per cold start
  // Vercel's Fluid compute keeps functions warm between requests,
  // so this is effectively a module-level singleton per function instance
  db = createPrismaClient();
} else {
  // In development, reuse the same client across HMR reloads
  if (!global.__db__) {
    global.__db__ = createPrismaClient();
  }
  db = global.__db__;
}

export { db };