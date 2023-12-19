import { PrismaClient } from "@prisma/client";

import { singleton } from "./singleton.server";

// Hard-code a unique key, so we can look up the client when this module gets re-imported
const prisma = singleton("prisma", () => new PrismaClient({ log: ['query', 'info', 'warn', 'error'],}));
prisma.$connect();

export { prisma };
