import { PrismaClient } from "@prisma/client";

// Vercel's serverless functions re-evaluate modules per instance; without this
// the dev server accumulates a client (and a connection) per hot reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
