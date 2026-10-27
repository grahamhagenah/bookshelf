// Settings from .env, wherever the app starts without them (npm start, the
// seed and scripts), as Prisma's client used to load them; production
// has none, and sets its own
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "~/generated/prisma/client";

import { databaseFile } from "../prisma/database-url";

import { singleton } from "./singleton.server";

// Hard-code a unique key, so we can look up the client when this module gets re-imported
// Every query is logged while developing; elsewhere only problems are
const prisma = singleton("prisma", () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set");
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: `file:${databaseFile(process.env.DATABASE_URL)}`,
    }),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["warn", "error"],
  });
});
prisma.$connect();

export { prisma };
