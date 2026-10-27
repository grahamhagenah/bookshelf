import "dotenv/config";
import { defineConfig } from "prisma/config";

import { databaseFile } from "./prisma/database-url";

// Where the schema, migrations and database are, for the Prisma CLI. Some
// commands (generate, on CI) need no database, so one isn't required here.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: `file:${databaseFile(process.env.DATABASE_URL ?? "file:./data.db")}`,
    // For checking the migrations against the schema
    shadowDatabaseUrl: `file:${databaseFile("file:./shadow.db")}`,
  },
});
