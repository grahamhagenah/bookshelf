import { PrismaClient } from "@prisma/client";

import { singleton } from "./singleton.server";

// Hard-code a unique key, so we can look up the client when this module gets re-imported
// Every query is logged while developing; elsewhere only problems are
const prisma = singleton(
  "prisma",
  () =>
    new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "info", "warn", "error"]
          : ["warn", "error"],
    }),
);
prisma.$connect();

export { prisma };
