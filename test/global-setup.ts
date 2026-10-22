import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

// A fresh test database for every run, built by the migrations, the same
// way the live database is
export function setup() {
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", {
    env: { ...process.env, DATABASE_URL: "file:./vitest.db?connection_limit=1" },
    stdio: "ignore",
  });
}

export function teardown() {
  for (const file of ["vitest.db", "vitest.db-journal"]) {
    rmSync(path.join("prisma", file), { force: true });
  }
}
