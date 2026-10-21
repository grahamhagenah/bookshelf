import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

// A fresh test database for every run, built from the current schema
export function setup() {
  execSync("npx prisma db push --force-reset --skip-generate", {
    env: { ...process.env, DATABASE_URL: "file:./vitest.db?connection_limit=1" },
    stdio: "ignore",
  });
}

export function teardown() {
  for (const file of ["vitest.db", "vitest.db-journal"]) {
    rmSync(path.join("prisma", file), { force: true });
  }
}
