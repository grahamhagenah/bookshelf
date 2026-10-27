import "@testing-library/jest-dom/vitest";

import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";

// This worker's own copy of the test database, made from the one the
// migrations built, before anything opens it
const copy = `vitest-${process.env.VITEST_POOL_ID ?? "1"}.db`;
if (!existsSync(path.join("prisma", copy))) {
  copyFileSync(path.join("prisma", "vitest.db"), path.join("prisma", copy));
}
process.env.DATABASE_URL = `file:./${copy}`;
